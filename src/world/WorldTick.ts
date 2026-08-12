export const WORLD_TICK_TYPES = ['fluid', 'neighbor_update', 'block_event'] as const;

export type WorldTickType = typeof WORLD_TICK_TYPES[number];

export interface WorldTickPayload {
  reason?: string;
  sourceX?: number;
  sourceY?: number;
  sourceZ?: number;
}

export function isWorldTickType(value: unknown): value is WorldTickType {
  return typeof value === 'string' && (WORLD_TICK_TYPES as readonly string[]).includes(value);
}
