import type { MobType } from './Mob';

export const LEAD_ITEM_ID = 420;
export const LEAD_PULL_START_DISTANCE = 10;
export const LEAD_BREAK_DISTANCE = 12;

const LEASHABLE_MOB_TYPES = new Set<MobType>([
  'cow',
  'pig',
  'sheep',
  'chicken',
  'wolf',
  'cat',
  'horse',
  'iron_golem',
]);

export function isLeadItemName(name: string): boolean {
  return name.replace(/^minecraft:/, '') === 'lead';
}

export function canLeashMob(type: MobType): boolean {
  return LEASHABLE_MOB_TYPES.has(type);
}

export interface LeadPullPlan {
  breakLead: boolean;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
}

export function getLeadPullPlan(
  dx: number,
  dy: number,
  dz: number,
  currentVelocity: { x: number; y: number; z: number },
): LeadPullPlan {
  const distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance) || distance > LEAD_BREAK_DISTANCE) {
    return { breakLead: true, velocityX: currentVelocity.x, velocityY: currentVelocity.y, velocityZ: currentVelocity.z };
  }
  if (distance <= LEAD_PULL_START_DISTANCE || distance < 0.001) {
    return { breakLead: false, velocityX: currentVelocity.x, velocityY: currentVelocity.y, velocityZ: currentVelocity.z };
  }

  const strength = Math.min(4, (distance - LEAD_PULL_START_DISTANCE) * 1.75);
  return {
    breakLead: false,
    velocityX: currentVelocity.x + (dx / distance) * strength,
    velocityY: currentVelocity.y + Math.max(-1.5, Math.min(1.5, (dy / distance) * strength)),
    velocityZ: currentVelocity.z + (dz / distance) * strength,
  };
}
