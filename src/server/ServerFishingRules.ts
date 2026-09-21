export type ServerFishingAction = 'cast' | 'reel';

export interface ServerFishingActionRequest {
  action: ServerFishingAction;
  itemId: number;
  direction: { x: number; y: number; z: number };
}

function normalizeDirection(x: unknown, y: unknown, z: unknown) {
  const dx = Number(x);
  const dy = Number(y);
  const dz = Number(z);
  if (![dx, dy, dz].every(Number.isFinite)) return null;
  const length = Math.hypot(dx, dy, dz);
  if (length <= 1e-9) return null;
  return { x: dx / length, y: dy / length, z: dz / length };
}

export function parseServerFishingAction(payload: unknown): ServerFishingActionRequest | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  if (raw.action !== 'cast' && raw.action !== 'reel') return null;
  const itemId = Number(raw.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0) return null;
  const direction = normalizeDirection(raw.dirX, raw.dirY, raw.dirZ);
  if (!direction) return null;
  return { action: raw.action, itemId, direction };
}

export const SERVER_FISHING_LOOT = [
  { itemId: 349, weight: 70 },
  { itemId: (1 << 10) | 349, weight: 18 },
  { itemId: (2 << 10) | 349, weight: 8 },
  { itemId: (3 << 10) | 349, weight: 4 },
] as const;

export function rollServerFishingLoot(rng: () => number): number {
  const total = SERVER_FISHING_LOOT.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.max(0, Math.min(0.999999999, rng())) * total;
  for (const entry of SERVER_FISHING_LOOT) {
    if (roll < entry.weight) return entry.itemId;
    roll -= entry.weight;
  }
  return SERVER_FISHING_LOOT[0].itemId;
}

export function rollServerFishingXp(rng: () => number): number {
  return 1 + Math.floor(Math.max(0, Math.min(0.999999999, rng())) * 6);
}

/** Base Java wait window without Lure/weather modifiers. */
export function getServerFishingWaitSeconds(rng: () => number): number {
  return 5 + Math.max(0, Math.min(0.999999999, rng())) * 25;
}

export const SERVER_FISHING_HOOKED_SECONDS = 2;
