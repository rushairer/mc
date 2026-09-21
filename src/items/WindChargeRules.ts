export const WIND_CHARGE_COOLDOWN_SECONDS = 0.5;
export const WIND_CHARGE_SPEED = 30;
export const WIND_CHARGE_DIRECT_DAMAGE = 1;
/**
 * Java's player-thrown wind charge uses explosion power 1.2. Explosion
 * influence reaches twice the power, so this gameplay radius is 2.4 blocks.
 */
export const WIND_CHARGE_BURST_RADIUS = 2.4;
export const WIND_CHARGE_KNOCKBACK_SCALE = 3.3;

export interface WindBurstVector {
  x: number;
  y: number;
  z: number;
}

export function windBurstImpulse(
  source: WindBurstVector,
  target: WindBurstVector,
  radius = WIND_CHARGE_BURST_RADIUS,
): WindBurstVector {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dz = target.z - source.z;
  const distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance) || distance >= radius) return { x: 0, y: 0, z: 0 };

  const safeDistance = Math.max(distance, 0.18);
  const falloff = 1 - Math.min(1, distance / radius);
  const horizontalLength = Math.max(Math.hypot(dx, dz), 0.001);
  const horizontalScale = WIND_CHARGE_KNOCKBACK_SCALE * (0.35 + falloff * 0.65);
  const verticalScale = WIND_CHARGE_KNOCKBACK_SCALE * (0.55 + falloff * 0.75);

  return {
    x: dx / horizontalLength * horizontalScale,
    y: Math.max(0.75, dy / safeDistance * verticalScale + verticalScale),
    z: dz / horizontalLength * horizontalScale,
  };
}
