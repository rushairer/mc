export const SERVER_SIGN_LINE_COUNT = 4;
export const SERVER_SIGN_LINE_MAX_LENGTH = 15;

export interface ServerSignUpdateIntent {
  x: number;
  y: number;
  z: number;
  lines: [string, string, string, string];
}

const validCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);

export function parseServerSignUpdate(payload: unknown): ServerSignUpdateIntent | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  if (!validCoordinate(raw.x) || !validCoordinate(raw.y) || !validCoordinate(raw.z)) return null;
  if (!Array.isArray(raw.lines) || raw.lines.length !== SERVER_SIGN_LINE_COUNT) return null;

  const lines: string[] = [];
  for (const value of raw.lines) {
    if (typeof value !== 'string') return null;
    if (value.length > SERVER_SIGN_LINE_MAX_LENGTH || /[\r\n]/.test(value)) return null;
    lines.push(value);
  }

  return {
    x: raw.x,
    y: raw.y,
    z: raw.z,
    lines: lines as [string, string, string, string],
  };
}

export function isServerSignStylingItemName(name: string): boolean {
  const normalized = name.replace(/^minecraft:/, '').toLowerCase();
  return normalized === 'honeycomb'
    || normalized === 'glow_ink_sac'
    || normalized === 'ink_sac'
    || normalized.endsWith('_dye');
}
