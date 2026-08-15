/**
 * P4.1 — Procedural background music (pure data/logic, Web Audio synth).
 *
 * A tiny ambient music engine: a 2-second bar plays a 3-4 note chord from a
 * mode-appropriate scale, with a gentle key progression. All note data is
 * computed by pure functions so the scheduler is unit-testable.
 */

export type MusicMode = 'day' | 'night' | 'cave';

export interface MusicNote {
  freq: number;
  /** Seconds from the bar start. */
  startOffset: number;
  duration: number;
  gain: number;
}

export const MUSIC_BAR_SECONDS = 2;

/** Pick the music mode from the world state (1.20.1-ish day/night/cave). */
export function getMusicMode(isNight: boolean, isCave: boolean): MusicMode {
  if (isCave) return 'cave';
  return isNight ? 'night' : 'day';
}

// Scale degrees as semitone offsets from the root (MIDI-style).
const DAY_DEGREES = [0, 4, 7, 9, 12];   // C major pentatonic
const NIGHT_DEGREES = [0, 3, 7, 10, 12]; // A minor (natural)
const CAVE_DEGREES = [0, 2, 7, 12, 15]; // D minor-ish, darker

// Root notes (Hz) per mode; the progression walks these roots per bar.
const DAY_ROOTS = [130.81, 146.83, 174.61, 196.00];   // C3 D3 F3 G3
const NIGHT_ROOTS = [110.00, 130.81, 146.83, 98.00];  // A2 C3 D2 G2
const CAVE_ROOTS = [73.42, 87.31, 73.42, 98.00];      // D2 F2 D2 G2

const DEGREE_SETS: Record<MusicMode, number[]> = {
  day: DAY_DEGREES,
  night: NIGHT_DEGREES,
  cave: CAVE_DEGREES,
};

const ROOTS: Record<MusicMode, number[]> = {
  day: DAY_ROOTS,
  night: NIGHT_ROOTS,
  cave: CAVE_ROOTS,
};

const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * The 3-4 notes of the chord for the given bar (each bar advances the
 * progression root). `rng` drives the arpeggio order so it stays testable.
 */
export function getChordNotes(mode: MusicMode, bar: number, rng: () => number): MusicNote[] {
  const roots = ROOTS[mode];
  const degrees = DEGREE_SETS[mode];
  const root = roots[Math.abs(bar) % roots.length];
  const midiRoot = Math.round(69 + 12 * Math.log2(root / 440));

  // Pick 3 or 4 distinct degrees.
  const count = rng() < 0.4 ? 3 : 4;
  const picked = new Set<number>();
  const degreesPicked: number[] = [];
  while (degreesPicked.length < count) {
    const degree = degrees[Math.floor(rng() * degrees.length)];
    if (!picked.has(degree)) {
      picked.add(degree);
      degreesPicked.push(degree);
    }
  }

  // One octave-up shimmer on the top note every few bars.
  const shimmer = bar % 4 === 3 && count >= 3;
  return degreesPicked.map((degree, index) => ({
    freq: midiToHz(midiRoot + degree + (shimmer && index === degreesPicked.length - 1 ? 12 : 0)),
    startOffset: (index * 0.55) + rng() * 0.1,
    duration: MUSIC_BAR_SECONDS - 0.3,
    gain: 0.045 + rng() * 0.02,
  }));
}
