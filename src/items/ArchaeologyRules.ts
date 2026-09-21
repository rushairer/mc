export const BRUSH_DURABILITY = 64;
export const BRUSH_EXCAVATION_SECONDS = 4.8;
export const BRUSH_STAGE_COUNT = 4;

export function isSuspiciousBlockName(name: string | undefined): boolean {
  return name === 'suspicious_sand' || name === 'suspicious_gravel';
}

export function brushedReplacementName(name: string | undefined): 'sand' | 'gravel' | null {
  if (name === 'suspicious_sand') return 'sand';
  if (name === 'suspicious_gravel') return 'gravel';
  return null;
}

export function archaeologyBrushStage(elapsedSeconds: number): number {
  const elapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
  if (elapsed <= 0) return 0;
  return Math.min(BRUSH_STAGE_COUNT, Math.floor(elapsed / (BRUSH_EXCAVATION_SECONDS / BRUSH_STAGE_COUNT)));
}

export function isBrushExcavationComplete(elapsedSeconds: number): boolean {
  return Number.isFinite(elapsedSeconds) && elapsedSeconds + 1e-9 >= BRUSH_EXCAVATION_SECONDS;
}

export function archaeologyTargetKey(x: number, y: number, z: number): string {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

export function normalizeArchaeologyLootCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(64, Math.floor(parsed))) : 0;
}
