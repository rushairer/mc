export const SPYGLASS_ZOOM_MULTIPLIER = 0.1;
export const GOAT_HORN_COOLDOWN_SECONDS = 7;

export const GOAT_HORN_INSTRUMENTS = [
  'ponder',
  'sing',
  'seek',
  'feel',
  'admire',
  'call',
  'yearn',
  'dream',
] as const;

export type GoatHornInstrument = typeof GOAT_HORN_INSTRUMENTS[number];

export function spyglassFov(baseFov: number, active: boolean): number {
  const safeBase = Number.isFinite(baseFov) && baseFov > 0 ? baseFov : 70;
  return active ? Math.max(1, safeBase * SPYGLASS_ZOOM_MULTIPLIER) : safeBase;
}

export function normalizeGoatHornInstrument(value: unknown): GoatHornInstrument {
  return typeof value === 'string' && (GOAT_HORN_INSTRUMENTS as readonly string[]).includes(value)
    ? value as GoatHornInstrument
    : 'ponder';
}

export function goatHornSoundIndex(value: unknown): number {
  const instrument = normalizeGoatHornInstrument(value);
  return GOAT_HORN_INSTRUMENTS.indexOf(instrument);
}
