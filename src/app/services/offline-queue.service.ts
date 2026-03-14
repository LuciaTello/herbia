import { Injectable, signal } from '@angular/core';
import { openDB } from 'idb';
import { Filesystem, Directory } from '@capacitor/filesystem';

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
  readonly pendingCount = signal(0);
  readonly queue = signal<QueuedPhoto[]>([]);
  readonly syncMessage = signal<string | null>(null);

  constructor() {
    this.refreshQueue();
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
    const item: QueuedPhoto = { trekId, filename, createdAt: Date.now(), status: 'pending' };
    const id = (await db.add(STORE_PHOTOS, item)) as number;
    await this.refreshQueue();
    return id;
  }

  async dequeue(id: number): Promise<void> {
    const db = await getDb();
    const item: QueuedPhoto | undefined = await db.get(STORE_PHOTOS, id);
    if (item) {
      try {
        await Filesystem.deleteFile({ path: `${PHOTO_DIR}/${item.filename}`, directory: Directory.Data });
      } catch { /* already gone */ }
      await db.delete(STORE_PHOTOS, id);
    }
    await this.refreshQueue();
  }

  async refreshQueue(): Promise<void> {
    const db = await getDb();
    const all: QueuedPhoto[] = await db.getAll(STORE_PHOTOS);
    this.queue.set(all);
    this.pendingCount.set(all.filter(i => i.status === 'pending' || i.status === 'failed').length);
  }

  async loadFile(filename: string): Promise<File> {
    const { data } = await Filesystem.readFile({ path: `${PHOTO_DIR}/${filename}`, directory: Directory.Data });
    const binary = atob(data as string);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([new Blob([bytes], { type: 'image/jpeg' })], filename, { type: 'image/jpeg' });
  }

  async markFailed(id: number, error: string): Promise<void> {
    const db = await getDb();
    const item: QueuedPhoto | undefined = await db.get(STORE_PHOTOS, id);
    if (item) await db.put(STORE_PHOTOS, { ...item, status: 'failed', error });
    await this.refreshQueue();
  }

  async clear(): Promise<void> {
    const db = await getDb();
    const all: QueuedPhoto[] = await db.getAll(STORE_PHOTOS);
    for (const item of all) {
      try {
        await Filesystem.deleteFile({ path: `${PHOTO_DIR}/${item.filename}`, directory: Directory.Data });
      } catch { /* ignore */ }
    }
    await db.clear(STORE_PHOTOS);
    await this.refreshQueue();
  }
}
