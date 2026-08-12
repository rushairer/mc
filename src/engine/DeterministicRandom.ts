export interface RandomSource {
  next(): number;
  nextInt(maxExclusive: number): number;
  fork(salt: number): RandomSource;
  getState(): number;
}

function normalizeSeed(seed: number): number {
  const normalized = Number.isFinite(seed) ? seed | 0 : 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

/** Small deterministic generator for simulation systems and reproducible tests. */
export class XorShiftRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = normalizeSeed(seed);
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value | 0;
    return (this.state >>> 0) / 0x1_0000_0000;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error('maxExclusive must be a positive integer.');
    }
    return Math.floor(this.next() * maxExclusive);
  }

  fork(salt: number): RandomSource {
    return new XorShiftRandom(hashIntegers(this.state, salt));
  }

  getState(): number {
    return this.state;
  }
}

export function hashIntegers(...values: number[]): number {
  let hash = 0x811c9dc5;
  for (const value of values) {
    hash ^= normalizeSeed(value);
    hash = Math.imul(hash, 0x01000193);
    hash ^= hash >>> 16;
  }
  return hash | 0;
}

/** Stable coordinate sample; independent of call order. */
export function coordinateRandom(seed: number, x: number, y: number, z: number): number {
  // Keep the original double-to-int coercion order for existing world compatibility.
  let hash = (x * 374761393 + y * 668265263 + z * 1274126177 + seed) | 0;
  hash = (hash ^ (hash >> 13)) * 1274126177;
  hash = hash ^ (hash >> 16);
  return (hash & 0x7fffffff) / 0x7fffffff;
}
