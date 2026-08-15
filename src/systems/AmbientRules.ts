/**
 * P4.2 — Ambient sound rules (pure, testable).
 */

export type WeatherKind = 'clear' | 'rain' | 'thunder';

/** Rain noise loop gain per weather kind (0 = silent). */
export function getRainGain(kind: WeatherKind): number {
  if (kind === 'thunder') return 0.07;
  if (kind === 'rain') return 0.045;
  return 0;
}

/** Seconds between random cave drips (underground). */
export function getCaveDripInterval(rng: () => number): number {
  return 3 + rng() * 5;
}

/** Cave drip plink frequency in Hz. */
export function getCaveDripPitch(rng: () => number): number {
  return 600 + rng() * 300;
}

/** Low-pass cutoff for the rain noise (higher = brighter hiss). */
export function getRainFilterFrequency(kind: WeatherKind): number {
  return kind === 'thunder' ? 500 : 900;
}
