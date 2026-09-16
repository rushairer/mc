export const JAVA_WORLD_HORIZONTAL_LIMIT = 3.2e7;
export const JAVA_MOVE_TOO_FAST_THRESHOLD_SQ = 100;
export const JAVA_ELYTRA_MOVE_TOO_FAST_THRESHOLD_SQ = 300;

export interface ServerMoveIntent {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  flying: boolean;
  onGround: boolean;
  sprinting: boolean;
}

export interface ServerMovementSnapshot {
  x: number;
  y: number;
  z: number;
  onGround: boolean;
  sprinting: boolean;
}

export function parseServerMoveIntent(payload: unknown): ServerMoveIntent | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const z = Number(raw.z);
  const yaw = Number(raw.yaw);
  const pitch = Number(raw.pitch);
  if (![x, y, z, yaw, pitch].every(Number.isFinite)) return null;
  if (Math.abs(x) > JAVA_WORLD_HORIZONTAL_LIMIT || Math.abs(z) > JAVA_WORLD_HORIZONTAL_LIMIT) return null;
  return {
    x,
    y,
    z,
    yaw,
    pitch,
    flying: raw.flying === true,
    onGround: raw.onGround === true,
    sprinting: raw.sprinting === true,
  };
}

export function movementDistanceSquared(
  from: Pick<ServerMovementSnapshot, 'x' | 'y' | 'z'>,
  to: Pick<ServerMovementSnapshot, 'x' | 'y' | 'z'>,
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Vanilla's gross movement guard compares reported displacement squared with
 * expected velocity squared and rubber-bands when the excess exceeds 100
 * (300 while fall-flying).
 */
export function isMoveTooFast(
  from: Pick<ServerMovementSnapshot, 'x' | 'y' | 'z'>,
  to: Pick<ServerMovementSnapshot, 'x' | 'y' | 'z'>,
  expectedVelocitySquared = 0,
  fallFlying = false,
): boolean {
  const threshold = fallFlying ? JAVA_ELYTRA_MOVE_TOO_FAST_THRESHOLD_SQ : JAVA_MOVE_TOO_FAST_THRESHOLD_SQ;
  return movementDistanceSquared(from, to) - Math.max(0, expectedVelocitySquared) > threshold;
}

export function isSurvivalFlightSpoof(intent: ServerMoveIntent, allowFlying: boolean): boolean {
  return intent.flying && !allowFlying;
}

/** Server-observable critical prerequisite: airborne and descending. */
export function isDescendingAirborne(
  previous: ServerMovementSnapshot,
  current: ServerMoveIntent,
): boolean {
  return !current.onGround && current.y < previous.y - 1e-9;
}

export function snapshotMovement(intent: ServerMoveIntent): ServerMovementSnapshot {
  return {
    x: intent.x,
    y: intent.y,
    z: intent.z,
    onGround: intent.onGround,
    sprinting: intent.sprinting,
  };
}
