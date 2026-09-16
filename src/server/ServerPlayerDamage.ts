import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { getArmorToughness } from '../items/ArmorAttributes';
import { EnchantSystem } from '../systems/EnchantSystem';
import {
  applyDamageProtection,
  baseArmorApplies,
  type PlayerDamageKind,
  type ProtectionLevelTotals,
} from '../systems/DamageRules';
import {
  getArmorDurabilityDamage,
  getDurabilityUseChance,
} from '../systems/DurabilityRules';
import {
  getAxeShieldDisableSeconds,
  getBlockedShieldDurabilityDamage,
  isShieldBlockActive,
  shieldCanBlockDamage,
  shieldFacesSource,
} from '../systems/ShieldRules';

export interface ServerArmorSnapshot {
  armorPoints: number;
  toughness: number;
  protectionLevels: ProtectionLevelTotals;
}

export interface ServerShieldState {
  isBlocking: boolean;
  usingSeconds: number;
  disabledSeconds: number;
  x: number;
  z: number;
  yaw: number;
}

export interface ServerShieldResult {
  blocked: boolean;
  durabilityDamage: number;
  disableSeconds: number;
}

export function getServerArmorSnapshot(armor: Array<ItemStack | null | undefined>): ServerArmorSnapshot {
  let armorPoints = 0;
  let toughness = 0;
  const protectionLevels: ProtectionLevelTotals = {
    protection: 0,
    fireProtection: 0,
    blastProtection: 0,
    projectileProtection: 0,
    featherFalling: 0,
  };

  for (const stack of armor) {
    if (!stack) continue;
    const def = ItemRegistry.get(stack.id);
    armorPoints += def?.armorDefense ?? 0;
    toughness += getArmorToughness(def?.name);
    protectionLevels.protection! += EnchantSystem.getLevel(stack, 'protection');
    protectionLevels.fireProtection! += EnchantSystem.getLevel(stack, 'fire_protection');
    protectionLevels.blastProtection! += EnchantSystem.getLevel(stack, 'blast_protection');
    protectionLevels.projectileProtection! += EnchantSystem.getLevel(stack, 'projectile_protection');
    protectionLevels.featherFalling! += EnchantSystem.getLevel(stack, 'feather_falling');
  }

  return { armorPoints, toughness, protectionLevels };
}

export function mitigateServerPlayerDamage(
  rawDamage: number,
  kind: PlayerDamageKind,
  armor: Array<ItemStack | null | undefined>,
): number {
  const snapshot = getServerArmorSnapshot(armor);
  return applyDamageProtection(
    rawDamage,
    kind,
    snapshot.armorPoints,
    snapshot.toughness,
    snapshot.protectionLevels,
  );
}

/**
 * Damage a breakable stack using its registry max durability and Unbreaking.
 * Durability in ItemStack is remaining durability in this project.
 */
export function damageDurableStack(
  stack: ItemStack | null | undefined,
  amount: number,
  kind: 'tool' | 'armor' = 'tool',
  random: () => number = Math.random,
): ItemStack | null {
  if (!stack) return null;
  const def = ItemRegistry.get(stack.id);
  const maxDurability = def?.durability;
  if (!maxDurability || !Number.isFinite(amount) || amount <= 0) return { ...stack };

  let remaining = stack.durability ?? maxDurability;
  const useChance = getDurabilityUseChance(EnchantSystem.getLevel(stack, 'unbreaking'), kind);
  for (let i = 0; i < Math.floor(amount); i++) {
    if (random() < useChance) remaining -= 1;
    if (remaining <= 0) return null;
  }
  return { ...stack, durability: remaining };
}

export function damageServerArmorForHit(
  armor: Array<ItemStack | null>,
  rawDamage: number,
  kind: PlayerDamageKind,
  random: () => number = Math.random,
): Array<ItemStack | null> {
  if (!baseArmorApplies(kind)) return armor.map((stack) => stack ? { ...stack } : null);
  const durabilityDamage = getArmorDurabilityDamage(rawDamage);
  if (durabilityDamage <= 0) return armor.map((stack) => stack ? { ...stack } : null);
  return armor.map((stack) => damageDurableStack(stack, durabilityDamage, 'armor', random));
}

export function resolveServerShieldBlock(
  rawDamage: number,
  kind: PlayerDamageKind,
  shield: ServerShieldState,
  sourceX: number,
  sourceZ: number,
  isAxeHit: boolean,
): ServerShieldResult {
  if (!shield.isBlocking || !shieldCanBlockDamage(kind)) {
    return { blocked: false, durabilityDamage: 0, disableSeconds: 0 };
  }
  if (!isShieldBlockActive(shield.usingSeconds, shield.disabledSeconds)) {
    return { blocked: false, durabilityDamage: 0, disableSeconds: 0 };
  }

  const facingX = -Math.sin(shield.yaw);
  const facingZ = -Math.cos(shield.yaw);
  const sourceToPlayerX = shield.x - sourceX;
  const sourceToPlayerZ = shield.z - sourceZ;
  if (!shieldFacesSource(facingX, facingZ, sourceToPlayerX, sourceToPlayerZ)) {
    return { blocked: false, durabilityDamage: 0, disableSeconds: 0 };
  }

  return {
    blocked: true,
    durabilityDamage: getBlockedShieldDurabilityDamage(rawDamage),
    disableSeconds: getAxeShieldDisableSeconds(isAxeHit),
  };
}
