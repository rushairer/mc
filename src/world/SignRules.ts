const normalize = (name: string) => name.toLowerCase().replace(/^minecraft:/, '');

/** True for standing, wall, ceiling-hanging, and wall-hanging signs. */
export function isSignBlockName(name: string): boolean {
  const normalized = normalize(name);
  return normalized === 'sign' || normalized === 'standing_sign' || normalized === 'wall_sign' || normalized.endsWith('_sign');
}

export function isWallSignBlockName(name: string): boolean {
  const normalized = normalize(name);
  return normalized === 'wall_sign' || normalized.endsWith('_wall_sign') || normalized.endsWith('_wall_hanging_sign');
}

export function isHangingSignBlockName(name: string): boolean {
  return normalize(name).includes('hanging_sign');
}

/** Resolve the wall-mounted block variant for a sign item/block name. */
export function getWallSignVariantName(name: string): string | undefined {
  const normalized = normalize(name);
  if (isWallSignBlockName(normalized)) return undefined;
  if (normalized === 'standing_sign' || normalized === 'sign') return 'wall_sign';
  if (normalized.endsWith('_hanging_sign')) {
    return normalized.replace(/_hanging_sign$/, '_wall_hanging_sign');
  }
  if (normalized.endsWith('_sign')) {
    return normalized.replace(/_sign$/, '_wall_sign');
  }
  return undefined;
}
