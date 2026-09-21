export type ServerMobRideAction = 'mount' | 'dismount';

export interface ServerMobRideInteraction {
  mobId: number;
  action: ServerMobRideAction;
}

export interface ServerMobRideInput {
  mobId: number;
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
}

export function parseServerMobRideInteraction(payload: unknown): ServerMobRideInteraction | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const mobId = Number(raw.mobId);
  if (!Number.isInteger(mobId) || mobId < 0) return null;
  if (raw.action !== 'mount' && raw.action !== 'dismount') return null;
  return { mobId, action: raw.action };
}

export function parseServerMobRideInput(payload: unknown): ServerMobRideInput | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const mobId = Number(raw.mobId);
  if (!Number.isInteger(mobId) || mobId < 0) return null;
  const bool = (value: unknown) => value === true;
  return {
    mobId,
    forward: bool(raw.forward),
    back: bool(raw.back),
    left: bool(raw.left),
    right: bool(raw.right),
    jump: bool(raw.jump),
  };
}

export function createIdleServerMobRideInput(mobId: number): ServerMobRideInput {
  return { mobId, forward: false, back: false, left: false, right: false, jump: false };
}
