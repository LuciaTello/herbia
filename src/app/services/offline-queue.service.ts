import { effect, inject, Injectable, signal } from '@angular/core';
import { openDB } from 'idb';
import { ConnectivityService } from './connectivity.service';
import { TrekService } from './trek.service';
import { I18nService } from '../i18n';

export interface QueuedPhoto {
  id?: number;
  trekId: number;
  blob: Blob;
  createdAt: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

const DB_NAME = 'herbia-offline';
const DB_VERSION = 1;
const STORE_PHOTOS = 'photos';

function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
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

  async enqueue(trekId: number, file: File): Promise<void> {
    const db = await getDb();
    const item: QueuedPhoto = {
      trekId,
      blob: file,
      createdAt: Date.now(),
      status: 'pending',
    };
    await db.add(STORE_PHOTOS, item);
    await this.refreshCount();
  }

  async syncAll(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const db = await getDb();
      const all: QueuedPhoto[] = await db.getAllFromIndex(STORE_PHOTOS, 'status', 'pending');
      if (!all.length) return;

      const t = this.i18n.t();
      this.syncMessage.set(t.offline.syncing(all.length));

      let synced = 0;
      let failed = 0;

      for (const item of all) {
        try {
          await db.put(STORE_PHOTOS, { ...item, status: 'syncing' });

          const file = new File([item.blob], 'queued-photo.jpg', { type: item.blob.type || 'image/jpeg' });

          const result = await this.trekService.identifyAll(item.trekId, file);
          const pn = result.plantnetResult;

          const available = result.matches.filter(m => !m.alreadyCaptured);
          if (available.length > 0) {
            const best = available.reduce((a, b) => a.similarity >= b.similarity ? a : b);
            await this.trekService.uploadPlantPhoto(
              best.plantId, file, best.similarity,
              pn ? { identifiedAs: pn.identifiedAs, commonName: pn.commonName } : undefined,
            );
          } else {
            const prevResult = pn?.identifiedAs
              ? { match: false, score: pn.score, identifiedAs: pn.identifiedAs, commonName: pn.commonName, similarity: 0, genus: pn.genus, family: pn.family }
              : undefined;
            await this.trekService.addUserPlant(item.trekId, file, prevResult);
          }

          await db.delete(STORE_PHOTOS, item.id!);
          synced++;
        } catch (err: any) {
          await db.put(STORE_PHOTOS, { ...item, status: 'failed', error: err?.message || 'Unknown error' });
          failed++;
        }
      }

      await this.refreshCount();

      const tt = this.i18n.t();
      if (failed > 0) {
        this.syncMessage.set(tt.offline.syncFailed(failed));
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
