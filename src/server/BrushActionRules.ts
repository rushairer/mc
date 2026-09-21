export const SERVER_BRUSH_DURATION_TICKS = 96;

export type ServerBrushAction = 'start' | 'complete' | 'cancel';

export interface ServerBrushActionIntent {
  action: ServerBrushAction;
  itemId: number;
  x: number;
  y: number;
  z: number;
}

export function parseServerBrushAction(payload: unknown): ServerBrushActionIntent | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const action = raw.action;
  if (action !== 'start' && action !== 'complete' && action !== 'cancel') return null;
  const itemId = Number(raw.itemId);
  const x = Number(raw.x);
  const y = Number(raw.y);
  const z = Number(raw.z);
  if (!Number.isInteger(itemId) || itemId <= 0) return null;
  if (![x, y, z].every(Number.isInteger)) return null;
  return { action, itemId, x, y, z };
}

export function isServerBrushDurationComplete(startTick: number, currentTick: number): boolean {
  if (!Number.isInteger(startTick) || !Number.isInteger(currentTick) || currentTick < startTick) return false;
  return currentTick - startTick >= SERVER_BRUSH_DURATION_TICKS;
}

export function sameServerBrushTarget(
  a: Pick<ServerBrushActionIntent, 'x' | 'y' | 'z'>,
  b: Pick<ServerBrushActionIntent, 'x' | 'y' | 'z'>,
): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
