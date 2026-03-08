import { Injectable } from '@angular/core';
import { openDB } from 'idb';
import { Trek } from '../models/plant.model';

const DB_NAME = 'herbia-offline';
const DB_VERSION = 1;
const STORE_TREKS = 'treks';

function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true })
          .createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains(STORE_TREKS)) {
        db.createObjectStore(STORE_TREKS);
      }
    },
  });
}

@Injectable({ providedIn: 'root' })
export class TrekCacheService {
  async save(treks: Trek[]): Promise<void> {
    const db = await getDb();
    await db.put(STORE_TREKS, { treks, updatedAt: Date.now() }, 'data');
  }

  async load(): Promise<Trek[] | null> {
    const db = await getDb();
    const entry = await db.get(STORE_TREKS, 'data');
    return entry?.treks ?? null;
  }

  async clear(): Promise<void> {
    const db = await getDb();
    await db.clear(STORE_TREKS);
  }
}
