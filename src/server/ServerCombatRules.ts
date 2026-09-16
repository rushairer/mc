import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { getAttackCooldownSeconds, getMeleeAttackDamage } from '../items/CombatAttributes';
import { calculateMeleeDamage } from '../systems/CombatRules';
import { EnchantSystem } from '../systems/EnchantSystem';
import { getMeleeDurabilityCost } from '../systems/DurabilityRules';

export const SURVIVAL_ENTITY_REACH = 3;
export const CREATIVE_ENTITY_REACH = 5;

export interface ServerPosition {
  x: number;
  y: number;
  z: number;
}

export interface EntityAttackIntent {
  entityId: number | string;
}

export interface ServerMeleeProfile {
  baseAttributeDamage: number;
  enchantmentDamage: number;
  cooldownTicks: number;
  isAxe: boolean;
  durabilityCost: number;
}

export function parseEntityAttackIntent(payload: unknown): EntityAttackIntent | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  if (raw.type !== 'attack') return null;

  const entityId = raw.entityId;
  if (typeof entityId === 'number') {
    if (!Number.isInteger(entityId) || entityId < 0) return null;
    return { entityId };
  }
  if (typeof entityId === 'string') {
    const normalized = entityId.trim();
    return normalized.length > 0 ? { entityId: normalized } : null;
  }
  return null;
}

export function getEntityInteractionReach(gameMode: 'survival' | 'creative' = 'survival'): number {
  return gameMode === 'creative' ? CREATIVE_ENTITY_REACH : SURVIVAL_ENTITY_REACH;
}

/**
 * Server-side entity reach check. Player positions are feet positions, so use
 * the Java eye height and a representative target body center instead of the
 * feet-to-feet distance used by the old multiplayer path.
 */
export function isEntityAttackInReach(
  attacker: ServerPosition,
  target: ServerPosition,
  gameMode: 'survival' | 'creative' = 'survival',
): boolean {
  const dx = target.x - attacker.x;
  const dy = (target.y + 0.9) - (attacker.y + 1.62);
  const dz = target.z - attacker.z;
  const reach = getEntityInteractionReach(gameMode);
  return dx * dx + dy * dy + dz * dz <= reach * reach + 1e-9;
}

export function getServerMeleeProfile(stack: ItemStack | null | undefined): ServerMeleeProfile {
  const def = stack ? ItemRegistry.get(stack.id) : undefined;
  const baseAttributeDamage = def?.damage ?? getMeleeAttackDamage(def?.toolType, def?.toolMaterial);
  const sharpnessLevel = EnchantSystem.getLevel(stack, 'sharpness');
  return {
    baseAttributeDamage,
    enchantmentDamage: EnchantSystem.getSharpnessBonus(sharpnessLevel),
    cooldownTicks: getAttackCooldownSeconds(def?.toolType, def?.toolMaterial) * 20,
    isAxe: def?.toolType === 'axe',
    durabilityCost: getMeleeDurabilityCost(def?.toolType),
  };
}

export function getAttackStrength(
  lastAttackTick: number | null | undefined,
  currentTick: number,
  cooldownTicks: number,
): number {
  if (lastAttackTick === null || lastAttackTick === undefined || lastAttackTick < 0) return 1;
  if (!Number.isFinite(currentTick) || !Number.isFinite(cooldownTicks) || cooldownTicks <= 0) return 0;
  const elapsed = Math.max(0, currentTick - lastAttackTick);
  return Math.max(0, Math.min(1, elapsed / cooldownTicks));
}

/**
 * Derive melee damage exclusively from the server-owned held stack and attack
 * cadence. Client-provided damage values are deliberately not accepted.
 */
export function getServerMeleeDamage(
  stack: ItemStack | null | undefined,
  lastAttackTick: number | null | undefined,
  currentTick: number,
): number {
  const profile = getServerMeleeProfile(stack);
  const cooldownProgress = getAttackStrength(lastAttackTick, currentTick, profile.cooldownTicks);
  return calculateMeleeDamage({
    baseAttributeDamage: profile.baseAttributeDamage,
    enchantmentDamage: profile.enchantmentDamage,
    cooldownProgress,
    critical: false,
  });
}
