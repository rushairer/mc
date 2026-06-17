import type { SerializedBlockMetadata } from '../types';

const DB_NAME = 'minecraft_clone_save';
const DB_VERSION = 1;
const STORE_NAME = 'worlds';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface SaveData {
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    health: number;
    hunger: number;
    flying: boolean;
    gameMode?: 'survival' | 'creative';
  };
  inventory: {
    slots: ({ id: number; count: number } | null)[];
    armor: ({ id: number; count: number } | null)[];
  };
  seed: number;
  chunks: { cx: number; cz: number; data: Uint8Array; metadata?: SerializedBlockMetadata[] }[];
  timestamp: number;
}

export const SaveSystem = {
  async save(data: SaveData, slot: string = 'world_1'): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(data, slot);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async load(slot: string = 'world_1'): Promise<SaveData | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(slot);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  },

  async hasSave(slot: string = 'world_1'): Promise<boolean> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count(slot);
      req.onsuccess = () => { db.close(); resolve(req.result > 0); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  },

  async deleteSave(slot: string = 'world_1'): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(slot);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },
};
