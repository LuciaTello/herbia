import { effect, inject, Injectable, signal } from '@angular/core';
import { openDB } from 'idb';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ConnectivityService } from './connectivity.service';
import { TrekService } from './trek.service';
import { I18nService } from '../i18n';

export interface QueuedPhoto {
  id?: number;
  trekId: number;
  filename: string;
  createdAt: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

const DB_NAME = 'herbia-offline';
const DB_VERSION = 2;
const STORE_PHOTOS = 'photos';
const PHOTO_DIR = 'herbia_photos';

function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 2 && db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.deleteObjectStore(STORE_PHOTOS);
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS, { keyPath: 'id', autoIncrement: true })
          .createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains('treks')) {
        db.createObjectStore('treks');
      }
    },
  });
}

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly connectivity = inject(ConnectivityService);
  private readonly trekService = inject(TrekService);
  private readonly i18n = inject(I18nService);

  readonly pendingCount = signal(0);
  readonly syncMessage = signal<string | null>(null);

  private syncing = false;

  constructor() {
    this.refreshCount();

    effect(() => {
      if (this.connectivity.online()) {
        this.syncAll();
      }
    });
  }

  async enqueue(trekId: number, file: File): Promise<number> {
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;

    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
    );

    await Filesystem.writeFile({
      path: `${PHOTO_DIR}/${filename}`,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });

    const db = await getDb();
    const item: QueuedPhoto = {
      trekId,
      filename,
      createdAt: Date.now(),
      status: 'pending',
    };
    const id = (await db.add(STORE_PHOTOS, item)) as number;
    await this.refreshCount();
    return id;
  }

  async dequeue(id: number): Promise<void> {
    const db = await getDb();
    const item: QueuedPhoto | undefined = await db.get(STORE_PHOTOS, id);
    if (item) {
      try {
        await Filesystem.deleteFile({
          path: `${PHOTO_DIR}/${item.filename}`,
          directory: Directory.Data,
        });
      } catch {
        // File may already be deleted
      }
      await db.delete(STORE_PHOTOS, id);
    }
    await this.refreshCount();
  }

  async syncAll(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const db = await getDb();
      const pending: QueuedPhoto[] = await db.getAllFromIndex(STORE_PHOTOS, 'status', 'pending');
      const failed: QueuedPhoto[] = await db.getAllFromIndex(STORE_PHOTOS, 'status', 'failed');
      const all = [...pending, ...failed];
      if (!all.length) return;

      const t = this.i18n.t();
      this.syncMessage.set(t.offline.syncing(all.length));

      let synced = 0;
      let failedCount = 0;

      for (const item of all) {
        try {
          await db.put(STORE_PHOTOS, { ...item, status: 'syncing' });

          const { data } = await Filesystem.readFile({
            path: `${PHOTO_DIR}/${item.filename}`,
            directory: Directory.Data,
          });

          const binary = atob(data as string);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'image/jpeg' });
          const file = new File([blob], 'queued-photo.jpg', { type: 'image/jpeg' });

          const result = await this.trekService.identifyAll(item.trekId, file);
          const pn = result.plantnetResult;

          const available = result.matches.filter(m => !m.alreadyCaptured);
          if (available.length > 0) {
            const best = available.reduce((a, b) => (a.similarity >= b.similarity ? a : b));
            await this.trekService.uploadPlantPhoto(
              best.plantId,
              file,
              best.similarity,
              pn ? { identifiedAs: pn.identifiedAs, commonName: pn.commonName } : undefined,
            );
          } else {
            const prevResult = pn?.identifiedAs
              ? {
                  match: false,
                  score: pn.score,
                  identifiedAs: pn.identifiedAs,
                  commonName: pn.commonName,
                  similarity: 0,
                  genus: pn.genus,
                  family: pn.family,
                }
              : undefined;
            await this.trekService.addUserPlant(item.trekId, file, prevResult);
          }

          try {
            await Filesystem.deleteFile({
              path: `${PHOTO_DIR}/${item.filename}`,
              directory: Directory.Data,
            });
          } catch {
            // Ignore cleanup errors
          }
          await db.delete(STORE_PHOTOS, item.id!);
          synced++;
        } catch (err: any) {
          await db.put(STORE_PHOTOS, {
            ...item,
            status: 'failed',
            error: err?.message || 'Unknown error',
          });
          failedCount++;
        }
      }

      await this.refreshCount();

      const tt = this.i18n.t();
      if (failedCount > 0) {
        this.syncMessage.set(tt.offline.syncFailed(failedCount));
      } else {
        this.syncMessage.set(tt.offline.syncDone(synced));
      }
      setTimeout(() => this.syncMessage.set(null), 4000);

      if (synced > 0) {
        await this.trekService.loadTreks();
      }
    } finally {
      this.syncing = false;
    }
  }

  async clear(): Promise<void> {
    const db = await getDb();
    const all: QueuedPhoto[] = await db.getAll(STORE_PHOTOS);
    for (const item of all) {
      try {
        await Filesystem.deleteFile({
          path: `${PHOTO_DIR}/${item.filename}`,
          directory: Directory.Data,
        });
      } catch {
        // Ignore cleanup errors
      }
    }
    await db.clear(STORE_PHOTOS);
    this.pendingCount.set(0);
  }

  private async refreshCount(): Promise<void> {
    const db = await getDb();
    const pending = await db.countFromIndex(STORE_PHOTOS, 'status', 'pending');
    const failed = await db.countFromIndex(STORE_PHOTOS, 'status', 'failed');
    this.pendingCount.set(pending + failed);
  }
}
