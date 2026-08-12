import type { SerializedBlockMetadata } from '../types';
import type { ActivePotionEffect, ItemStack } from '../types';
import type { MobType } from '../entities/Mob';
import { TickScheduler, type ScheduledTick, type TickPriority } from './TickScheduler';
import { isWorldTickType, type WorldTickPayload, type WorldTickType } from '../world/WorldTick';
import { WORLD_HEIGHT } from '../constants';

const DB_NAME = 'minecraft_clone_save';
const DB_VERSION = 1;
const STORE_NAME = 'worlds';

export const SAVE_SCHEMA_VERSION = 3;
// Temporary global safety caps until entity culling/object pooling are in place.
export const MAX_RESTORED_MOBS_PER_DIMENSION = 24;
export const MAX_RECOVERED_MOBS_PER_DIMENSION = 16;
const MAX_REASONABLE_CHUNKS_PER_DIMENSION = 4096;
const MAX_SCHEDULED_BLOCK_TICKS = 65536;
const MAX_COORDINATE = 30_000_000;

export type SaveDimensionId = 0 | 1 | 2;
export type SavedBlockTick = ScheduledTick<WorldTickType, WorldTickPayload>;

export interface SavedChunk {
  cx: number;
  cz: number;
  data: Uint16Array;
  metadata?: SerializedBlockMetadata[];
}

export interface DimensionSaveData {
  chunks: SavedChunk[];
  mobs: SerializedMob[];
}

export interface SaveRecoveryInfo {
  migratedFrom: number;
  recovered: boolean;
  warnings: string[];
  processedAt: number;
}

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
  schemaVersion: number;
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
    currentDimension?: SaveDimensionId;
  };
  inventory: {
    slots: (ItemStack | null)[];
    armor: (ItemStack | null)[];
    offhand?: ItemStack | null;
  };
  seed: number;
  dimensions: Partial<Record<SaveDimensionId, DimensionSaveData>>;
  endDragonDefeated?: boolean;
  endDragonHealth?: number;
  gamerules?: {
    difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
    rules: unknown;
  };
  advancements?: string[];
  simulationTick?: number;
  scheduledBlockTicks?: SavedBlockTick[];
  recovery?: SaveRecoveryInfo;
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

interface LegacyChunk extends SavedChunk {
  dimension?: number;
}

interface LegacySaveData {
  schemaVersion?: number;
  player?: Partial<SaveData['player']>;
  inventory?: Partial<SaveData['inventory']>;
  seed?: number;
  chunks?: LegacyChunk[];
  mobs?: SerializedMob[];
  dimensions?: SaveData['dimensions'];
  endDragonDefeated?: boolean;
  endDragonHealth?: number;
  gamerules?: SaveData['gamerules'];
  advancements?: string[];
  simulationTick?: number;
  scheduledBlockTicks?: SavedBlockTick[];
  recovery?: SaveRecoveryInfo;
  timestamp?: number;
}

const VALID_MOB_TYPES = new Set<MobType>([
  'zombie', 'skeleton', 'creeper', 'spider', 'cow', 'pig', 'sheep', 'chicken',
  'blaze', 'zombie_pigman', 'magma_cube', 'wither_skeleton', 'villager', 'enderman',
  'witch', 'iron_golem', 'wolf', 'cat', 'horse', 'shulker', 'pillager', 'wither',
  'guardian', 'vex',
]);
const HOSTILE_MOB_TYPES = new Set<MobType>([
  'zombie', 'skeleton', 'creeper', 'spider', 'blaze', 'zombie_pigman', 'magma_cube',
  'wither_skeleton', 'enderman', 'witch', 'shulker', 'pillager', 'wither', 'guardian', 'vex',
]);

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const normalizeDimension = (value: unknown): SaveDimensionId =>
  value === 1 ? 1 : value === 2 ? 2 : 0;

function migrateV0ToV1(raw: LegacySaveData, warnings: string[]): LegacySaveData {
  warnings.push('Migrated unversioned save to schema v1.');
  return { ...raw, schemaVersion: 1 };
}

function migrateV1ToV2(raw: LegacySaveData, warnings: string[]): LegacySaveData {
  const dimensions: SaveData['dimensions'] = raw.dimensions ? { ...raw.dimensions } : {};
  const legacyChunks = Array.isArray(raw.chunks) ? raw.chunks : [];
  const legacyMobs = Array.isArray(raw.mobs) ? raw.mobs : [];

  for (const dimension of [0, 1, 2] as const) {
    const existing = dimensions[dimension];
    dimensions[dimension] = {
      chunks: existing?.chunks ?? legacyChunks
        .filter((chunk) => normalizeDimension(chunk.dimension) === dimension)
        .map(({ cx, cz, data, metadata }) => ({ cx, cz, data, metadata })),
      mobs: existing?.mobs ?? legacyMobs.filter((mob) => normalizeDimension(mob.dimension) === dimension),
    };
  }

  warnings.push('Migrated flat chunk and mob storage to per-dimension schema v2.');
  const { chunks: _chunks, mobs: _mobs, ...rest } = raw;
  return { ...rest, schemaVersion: 2, dimensions };
}

function migrateV2ToV3(raw: LegacySaveData, warnings: string[]): LegacySaveData {
  warnings.push('Migrated save to schema v3 with persisted scheduled block ticks.');
  return {
    ...raw,
    schemaVersion: 3,
    scheduledBlockTicks: Array.isArray(raw.scheduledBlockTicks) ? raw.scheduledBlockTicks : [],
  };
}

const VALID_TICK_PRIORITIES = new Set<TickPriority>(['highest', 'high', 'normal', 'low']);

function sanitizeScheduledBlockTicks(
  raw: unknown,
  simulationTick: number,
  warnings: string[],
): SavedBlockTick[] {
  if (!Array.isArray(raw)) return [];

  const ticks = new Map<string, SavedBlockTick>();
  for (const entry of raw.slice(0, MAX_SCHEDULED_BLOCK_TICKS)) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<SavedBlockTick>;
    if (!isWorldTickType(candidate.type)) continue;

    const x = finiteOr(candidate.x, Number.NaN);
    const y = finiteOr(candidate.y, Number.NaN);
    const z = finiteOr(candidate.z, Number.NaN);
    const dimension = normalizeDimension(candidate.dimension);
    const dueTick = Math.floor(finiteOr(candidate.dueTick, Number.NaN));
    if (
      ![x, y, z, dueTick].every(Number.isFinite)
      || Math.abs(x) > MAX_COORDINATE
      || Math.abs(z) > MAX_COORDINATE
      || y < 0
      || y >= WORLD_HEIGHT
      || dueTick <= simulationTick
    ) continue;

    const payload = candidate.payload && typeof candidate.payload === 'object'
      ? candidate.payload as WorldTickPayload
      : undefined;
    const normalizedPayload: WorldTickPayload | undefined = payload ? {
      reason: typeof payload.reason === 'string' ? payload.reason.slice(0, 100) : undefined,
      sourceX: Number.isFinite(payload.sourceX) ? Math.floor(payload.sourceX!) : undefined,
      sourceY: Number.isFinite(payload.sourceY) ? Math.floor(payload.sourceY!) : undefined,
      sourceZ: Number.isFinite(payload.sourceZ) ? Math.floor(payload.sourceZ!) : undefined,
    } : undefined;
    const id = TickScheduler.positionKey(candidate.type, Math.floor(x), Math.floor(y), Math.floor(z), dimension);
    const tick: SavedBlockTick = {
      id,
      type: candidate.type,
      x: Math.floor(x),
      y: Math.floor(y),
      z: Math.floor(z),
      dimension,
      dueTick,
      priority: VALID_TICK_PRIORITIES.has(candidate.priority as TickPriority)
        ? candidate.priority as TickPriority
        : 'normal',
      payload: normalizedPayload,
      order: Math.max(0, Math.floor(finiteOr(candidate.order, ticks.size))),
    };
    const existing = ticks.get(id);
    if (!existing || tick.dueTick < existing.dueTick) ticks.set(id, tick);
  }

  if (raw.length > MAX_SCHEDULED_BLOCK_TICKS) {
    warnings.push(`Trimmed scheduled block ticks from ${raw.length} to ${MAX_SCHEDULED_BLOCK_TICKS}.`);
  }
  return Array.from(ticks.values()).sort((left, right) =>
    left.dueTick - right.dueTick || left.order - right.order,
  );
}

function sanitizeChunk(raw: unknown, warnings: string[], dimension: SaveDimensionId): SavedChunk | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<SavedChunk>;
  const rawData = (raw as { data?: unknown }).data;
  const cx = finiteOr(candidate.cx, Number.NaN);
  const cz = finiteOr(candidate.cz, Number.NaN);
  if (!Number.isInteger(cx) || !Number.isInteger(cz) || Math.abs(cx) > MAX_COORDINATE || Math.abs(cz) > MAX_COORDINATE) {
    warnings.push(`Dropped invalid chunk coordinates in dimension ${dimension}.`);
    return null;
  }

  let data: Uint16Array;
  if (rawData instanceof Uint16Array) {
    data = rawData;
  } else if (Array.isArray(rawData)) {
    data = Uint16Array.from(rawData.map((entry: unknown) => finiteOr(entry, 0)));
    warnings.push(`Recovered array-backed chunk ${cx},${cz} in dimension ${dimension}.`);
  } else {
    warnings.push(`Dropped chunk ${cx},${cz} with missing block data in dimension ${dimension}.`);
    return null;
  }

  return {
    cx,
    cz,
    data,
    metadata: Array.isArray(candidate.metadata) ? candidate.metadata : undefined,
  };
}

function sanitizeMobs(
  raw: unknown,
  dimension: SaveDimensionId,
  player: SaveData['player'],
  warnings: string[],
  protectRecoveredPlayer: boolean,
): SerializedMob[] {
  if (!Array.isArray(raw)) return [];

  const valid: SerializedMob[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const mob = entry as Partial<SerializedMob>;
    if (!VALID_MOB_TYPES.has(mob.type as MobType)) continue;
    const x = finiteOr(mob.x, Number.NaN);
    const y = finiteOr(mob.y, Number.NaN);
    const z = finiteOr(mob.z, Number.NaN);
    const health = finiteOr(mob.health, Number.NaN);
    if (![x, y, z, health].every(Number.isFinite)) continue;
    if (Math.abs(x) > MAX_COORDINATE || Math.abs(z) > MAX_COORDINATE || y < -128 || y > 1024 || health <= 0) continue;
    if (
      protectRecoveredPlayer &&
      dimension === player.currentDimension &&
      HOSTILE_MOB_TYPES.has(mob.type as MobType) &&
      Math.hypot(x - player.x, z - player.z) < 16
    ) continue;

    const key = `${mob.type}:${Math.round(x * 4)}:${Math.round(y * 4)}:${Math.round(z * 4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push({
      ...mob,
      type: mob.type as MobType,
      x,
      y,
      z,
      health,
      dimension,
    });
  }

  valid.sort((a, b) => {
    const priority = (mob: SerializedMob) => Number(!!mob.isTamed) * 4 + Number(mob.type === 'villager') * 2 + Number(!['zombie', 'skeleton', 'creeper', 'spider', 'witch', 'pillager', 'vex'].includes(mob.type));
    const priorityDelta = priority(b) - priority(a);
    if (priorityDelta !== 0) return priorityDelta;
    const distanceA = Math.hypot(a.x - player.x, a.z - player.z);
    const distanceB = Math.hypot(b.x - player.x, b.z - player.z);
    return distanceA - distanceB;
  });

  const maxMobs = protectRecoveredPlayer ? MAX_RECOVERED_MOBS_PER_DIMENSION : MAX_RESTORED_MOBS_PER_DIMENSION;
  if (valid.length > maxMobs) {
    warnings.push(`Trimmed dimension ${dimension} mobs from ${valid.length} to ${maxMobs}.`);
    valid.length = maxMobs;
  }
  return valid;
}

/** Pure migration and validation entry point used by IndexedDB and regression tests. */
export function migrateAndValidateSave(rawValue: unknown): SaveData {
  const warnings: string[] = [];
  const initial = rawValue && typeof rawValue === 'object' ? rawValue as LegacySaveData : {};
  const originalVersion = Number.isInteger(initial.schemaVersion) ? initial.schemaVersion as number : 0;
  if (originalVersion > SAVE_SCHEMA_VERSION) {
    throw new Error(`Save schema ${originalVersion} is newer than supported schema ${SAVE_SCHEMA_VERSION}.`);
  }

  let migrated = initial;
  let version = originalVersion;
  if (version === 0) {
    migrated = migrateV0ToV1(migrated, warnings);
    version = 1;
  }
  if (version === 1) {
    migrated = migrateV1ToV2(migrated, warnings);
    version = 2;
  }
  if (version === 2) {
    migrated = migrateV2ToV3(migrated, warnings);
    version = 3;
  }

  const rawPlayer = migrated.player ?? {};
  const player: SaveData['player'] = {
    x: clamp(finiteOr(rawPlayer.x, 0.5), -MAX_COORDINATE, MAX_COORDINATE),
    y: clamp(finiteOr(rawPlayer.y, 80), -128, 1024),
    z: clamp(finiteOr(rawPlayer.z, 0.5), -MAX_COORDINATE, MAX_COORDINATE),
    yaw: finiteOr(rawPlayer.yaw, 0),
    pitch: clamp(finiteOr(rawPlayer.pitch, 0), -Math.PI / 2, Math.PI / 2),
    health: clamp(finiteOr(rawPlayer.health, 20), 0, 20),
    hunger: clamp(finiteOr(rawPlayer.hunger, 20), 0, 20),
    flying: rawPlayer.flying === true,
    gameMode: rawPlayer.gameMode === 'creative' ? 'creative' : 'survival',
    perspectiveMode: rawPlayer.perspectiveMode === 'third' ? 'third' : 'first',
    xpLevel: Math.max(0, Math.floor(finiteOr(rawPlayer.xpLevel, 0))),
    xpCurrent: Math.max(0, Math.floor(finiteOr(rawPlayer.xpCurrent, 0))),
    xpTotal: Math.max(0, Math.floor(finiteOr(rawPlayer.xpTotal, 0))),
    activePotionEffects: Array.isArray(rawPlayer.activePotionEffects) ? rawPlayer.activePotionEffects : [],
    currentDimension: normalizeDimension(rawPlayer.currentDimension),
  };

  if (!migrated.player) warnings.push('Recovered missing player state with safe defaults.');
  const rawInventory = migrated.inventory ?? {};
  const slots = Array.isArray(rawInventory.slots) ? rawInventory.slots.slice(0, 36) : [];
  const armor = Array.isArray(rawInventory.armor) ? rawInventory.armor.slice(0, 4) : [];
  while (slots.length < 36) slots.push(null);
  while (armor.length < 4) armor.push(null);
  const protectRecoveredPlayer = originalVersion < 2 || migrated.recovery?.recovered === true ||
    [0, 1, 2].some((dimension) => (migrated.dimensions?.[dimension as SaveDimensionId]?.mobs?.length ?? 0) > MAX_RESTORED_MOBS_PER_DIMENSION);
  const dimensions: SaveData['dimensions'] = {};
  for (const dimension of [0, 1, 2] as const) {
    const source = migrated.dimensions?.[dimension];
    const chunks = (Array.isArray(source?.chunks) ? source.chunks : [])
      .slice(0, MAX_REASONABLE_CHUNKS_PER_DIMENSION)
      .map((chunk) => sanitizeChunk(chunk, warnings, dimension))
      .filter((chunk): chunk is SavedChunk => chunk !== null);
    if ((source?.chunks?.length ?? 0) > MAX_REASONABLE_CHUNKS_PER_DIMENSION) {
      warnings.push(`Trimmed excessive chunk count in dimension ${dimension}.`);
    }
    dimensions[dimension] = {
      chunks,
      mobs: sanitizeMobs(source?.mobs, dimension, player, warnings, protectRecoveredPlayer),
    };
  }

  const simulationTick = Math.max(0, Math.floor(finiteOr(migrated.simulationTick, 0)));
  const scheduledBlockTicks = sanitizeScheduledBlockTicks(migrated.scheduledBlockTicks, simulationTick, warnings);
  const priorWarnings = Array.isArray(migrated.recovery?.warnings) ? migrated.recovery.warnings : [];
  const allWarnings = [...priorWarnings, ...warnings].slice(-100);
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    player,
    inventory: {
      slots,
      armor,
      offhand: rawInventory.offhand ?? null,
    },
    seed: Math.floor(finiteOr(migrated.seed, 12345)),
    dimensions,
    endDragonDefeated: migrated.endDragonDefeated === true,
    endDragonHealth: Math.max(0, finiteOr(migrated.endDragonHealth, 200)),
    gamerules: migrated.gamerules,
    advancements: Array.isArray(migrated.advancements) ? migrated.advancements.filter((entry): entry is string => typeof entry === 'string') : [],
    simulationTick,
    scheduledBlockTicks,
    recovery: allWarnings.length > 0 ? {
      migratedFrom: originalVersion,
      recovered: warnings.some((warning) => /Dropped|Recovered|Trimmed/.test(warning)),
      warnings: allWarnings,
      processedAt: Date.now(),
    } : undefined,
    timestamp: finiteOr(migrated.timestamp, Date.now()),
  };
}

export const SaveSystem = {
  async save(data: SaveData, slot: string = 'world_1'): Promise<void> {
    const validated = migrateAndValidateSave(data);
    if (validated.recovery) validated.recovery.recovered = false;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(validated, slot);
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
      req.onsuccess = () => {
        db.close();
        try {
          resolve(req.result == null ? null : migrateAndValidateSave(req.result));
        } catch (error) {
          reject(error);
        }
      };
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
