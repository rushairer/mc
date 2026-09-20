export type ServerVehicleInteractionAction = 'mount' | 'dismount' | 'attack' | 'open_container';

export interface ServerVehicleInteractionIntent {
  vehicleId: number;
  action: ServerVehicleInteractionAction;
}

export interface ServerVehicleInputIntent {
  vehicleId: number;
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
}

export function parseServerVehicleInteraction(payload: unknown): ServerVehicleInteractionIntent | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const vehicleId = Number(raw.vehicleId);
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) return null;
  const action = raw.action;
  if (action !== 'mount' && action !== 'dismount' && action !== 'attack' && action !== 'open_container') return null;
  return { vehicleId, action };
}

export function parseServerVehicleInput(payload: unknown): ServerVehicleInputIntent | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const vehicleId = Number(raw.vehicleId);
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) return null;
  return {
    vehicleId,
    forward: raw.forward === true,
    back: raw.back === true,
    left: raw.left === true,
    right: raw.right === true,
  };
}

export function createIdleServerVehicleInput(vehicleId: number): ServerVehicleInputIntent {
  return { vehicleId, forward: false, back: false, left: false, right: false };
}

export function vehicleContainerKey(vehicleId: number): string {
  return `vehicle:${vehicleId}`;
}
