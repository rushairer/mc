import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { getAttackCooldownSeconds, getMeleeAttackDamage } from '../items/CombatAttributes';
import { calculateMeleeDamage } from '../systems/CombatRules';
import { EnchantSystem } from '../systems/EnchantSystem';
import { getMeleeDurabilityCost } from '../systems/DurabilityRules';

export const SURVIVAL_ENTITY_REACH = 3;
export const CREATIVE_ENTITY_REACH = 5;
export const CHARGED_ATTACK_THRESHOLD = 0.9;

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
  isSword: boolean;
  knockbackLevel: number;
  durabilityCost: number;
}

export interface ServerCriticalContext {
  descending: boolean;
  onGround: boolean;
  sprinting: boolean;
  flying?: boolean;
  inWater?: boolean;
  climbing?: boolean;
  riding?: boolean;
  blinded?: boolean;
}

export interface ServerKnockbackPlan {
  strength: number;
  sprintKnockback: boolean;
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

/** Java resolves attack-speed cooldown in whole ticks; an exact .5 rounds down. */
export function roundAttackCooldownTicks(theoreticalTicks: number): number {
  if (!Number.isFinite(theoreticalTicks) || theoreticalTicks <= 0) return 1;
  const floor = Math.floor(theoreticalTicks);
  return theoreticalTicks - floor > 0.5 ? floor + 1 : Math.max(1, floor);
}

export function getServerMeleeProfile(stack: ItemStack | null | undefined): ServerMeleeProfile {
  const def = stack ? ItemRegistry.get(stack.id) : undefined;
  const baseAttributeDamage = def?.damage ?? getMeleeAttackDamage(def?.toolType, def?.toolMaterial);
  return {
    baseAttributeDamage,
    enchantmentDamage: EnchantSystem.getSharpnessBonus(EnchantSystem.getLevel(stack, 'sharpness')),
    cooldownTicks: roundAttackCooldownTicks(getAttackCooldownSeconds(def?.toolType, def?.toolMaterial) * 20),
    isAxe: def?.toolType === 'axe',
    isSword: def?.toolType === 'sword',
    knockbackLevel: EnchantSystem.getLevel(stack, 'knockback'),
    durabilityCost: getMeleeDurabilityCost(def?.toolType),
  };
}

/** Java attack strength uses a half-tick bias: clamp((t + 0.5) / T, 0, 1). */
export function getAttackStrength(
  lastAttackTick: number | null | undefined,
  currentTick: number,
  cooldownTicks: number,
): number {
  if (lastAttackTick === null || lastAttackTick === undefined || lastAttackTick < 0) return 1;
  if (!Number.isFinite(currentTick) || !Number.isFinite(cooldownTicks) || cooldownTicks <= 0) return 0;
  const elapsed = Math.max(0, currentTick - lastAttackTick);
  return Math.max(0, Math.min(1, (elapsed + 0.5) / cooldownTicks));
}

export function isServerCriticalHit(attackStrength: number, context: ServerCriticalContext): boolean {
  return attackStrength > CHARGED_ATTACK_THRESHOLD
    && context.descending
    && !context.onGround
    && !context.sprinting
    && !context.flying
    && !context.inWater
    && !context.climbing
    && !context.riding
    && !context.blinded;
}

export function getServerKnockbackPlan(
  stack: ItemStack | null | undefined,
  attackStrength: number,
  sprinting: boolean,
): ServerKnockbackPlan {
  const profile = getServerMeleeProfile(stack);
  const sprintKnockback = sprinting && attackStrength > CHARGED_ATTACK_THRESHOLD;
  return {
    strength: profile.knockbackLevel + (sprintKnockback ? 1 : 0),
    sprintKnockback,
  };
}

export function applyKnockbackResistance(strength: number, resistance: number): number {
  const normalizedResistance = Math.max(0, Math.min(1, Number.isFinite(resistance) ? resistance : 0));
  return Math.max(0, strength) * (1 - normalizedResistance);
}

export function getNetheriteKnockbackResistance(armor: Array<ItemStack | null | undefined>): number {
  let pieces = 0;
  for (const stack of armor) {
    if (!stack) continue;
    const name = ItemRegistry.get(stack.id)?.name ?? '';
    if (name.includes('netherite_')) pieces += 1;
  }
  return Math.min(0.4, pieces * 0.1);
}

export function getServerMeleeDamage(
  stack: ItemStack | null | undefined,
  lastAttackTick: number | null | undefined,
  currentTick: number,
  critical = false,
): number {
  const profile = getServerMeleeProfile(stack);
  const cooldownProgress = getAttackStrength(lastAttackTick, currentTick, profile.cooldownTicks);
  return calculateMeleeDamage({
    baseAttributeDamage: profile.baseAttributeDamage,
    enchantmentDamage: profile.enchantmentDamage,
    cooldownProgress,
    critical,
  });
}
