import type { SerializedBlockMetadata } from '../types';
import type { ActivePotionEffect, ItemStack } from '../types';
import type { MobType } from '../entities/Mob';

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
    perspectiveMode?: 'first' | 'third';
    xpLevel?: number;
    xpCurrent?: number;
    xpTotal?: number;
    activePotionEffects?: ActivePotionEffect[];
    currentDimension?: number;
  };
  inventory: {
    slots: (ItemStack | null)[];
    armor: (ItemStack | null)[];
  };
  seed: number;
  chunks: { cx: number; cz: number; data: Uint16Array; metadata?: SerializedBlockMetadata[]; dimension?: number }[];
  mobs?: SerializedMob[];
  endDragonDefeated?: boolean;
  endDragonHealth?: number;
  gamerules?: {
    difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
    rules: any;
  };
  advancements?: string[];
  timestamp: number;
}

export interface SerializedMob {
  type: MobType;
  x: number;
  y: number;
  z: number;
  health: number;
  size?: number;
  dimension?: number;
  villagerProfession?: string;
  isBaby?: boolean;
  babyAge?: number;
  loveTimer?: number;
  breedCooldown?: number;
  isTamed?: boolean;
  isSitting?: boolean;
  isAngry?: boolean;
  angerTimer?: number;
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
