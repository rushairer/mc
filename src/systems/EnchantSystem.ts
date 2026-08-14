import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';

export type EnchantmentId =
  | 'sharpness' | 'efficiency' | 'protection' | 'unbreaking'
  | 'power' | 'punch' | 'flame' | 'fire_aspect' | 'knockback' | 'smite'
  | 'looting' | 'fortune' | 'silk_touch' | 'feather_falling' | 'thorns'
  | 'projectile_protection' | 'blast_protection' | 'fire_protection'
  | 'respiration' | 'depth_strider';

export interface Enchantment {
  id: EnchantmentId;
  level: number;
}

export interface EnchantOption {
  enchantment: Enchantment;
  cost: number;
  label: string;
  description: string;
}

type EnchantCategory = 'weapon' | 'sword' | 'bow' | 'tool' | 'armor' | 'breakable';

const ENCHANTMENT_DEFS: Record<EnchantmentId, {
  displayName: string;
  maxLevel: number;
  appliesTo: EnchantCategory[];
  description: (level: number) => string;
}> = {
  sharpness: {
    displayName: 'Sharpness', maxLevel: 5, appliesTo: ['sword'],
    description: (level) => `+${EnchantSystem.getSharpnessBonus(level)} melee damage`,
  },
  smite: {
    displayName: 'Smite', maxLevel: 5, appliesTo: ['sword'],
    description: (level) => `+${EnchantSystem.getSmiteBonus(level)} damage vs undead`,
  },
  fire_aspect: {
    displayName: 'Fire Aspect', maxLevel: 2, appliesTo: ['sword'],
    description: (level) => `Sets targets on fire for ${EnchantSystem.getFireTicks(level)} seconds`,
  },
  knockback: {
    displayName: 'Knockback', maxLevel: 2, appliesTo: ['sword'],
    description: (level) => `+${level} knockback`,
  },
  looting: {
    displayName: 'Looting', maxLevel: 3, appliesTo: ['sword'],
    description: (level) => `+${level} bonus mob drop rolls`,
  },
  power: {
    displayName: 'Power', maxLevel: 5, appliesTo: ['bow'],
    description: (level) => `+${Math.round((EnchantSystem.getPowerMultiplier(level) - 1) * 100)}% arrow damage`,
  },
  punch: {
    displayName: 'Punch', maxLevel: 2, appliesTo: ['bow'],
    description: (level) => `+${level} arrow knockback`,
  },
  flame: {
    displayName: 'Flame', maxLevel: 1, appliesTo: ['bow'],
    description: () => 'Arrows ignite targets',
  },
  efficiency: {
    displayName: 'Efficiency', maxLevel: 5, appliesTo: ['tool'],
    description: (level) => `${Math.round((EnchantSystem.getEfficiencyMultiplier(level) - 1) * 100)}% faster mining`,
  },
  fortune: {
    displayName: 'Fortune', maxLevel: 3, appliesTo: ['tool'],
    description: (level) => `+${level} ore drop rolls`,
  },
  silk_touch: {
    displayName: 'Silk Touch', maxLevel: 1, appliesTo: ['tool'],
    description: () => 'Mined blocks drop themselves',
  },
  protection: {
    displayName: 'Protection', maxLevel: 4, appliesTo: ['armor'],
    description: (level) => `${level * 4}% extra damage reduction`,
  },
  fire_protection: {
    displayName: 'Fire Protection', maxLevel: 4, appliesTo: ['armor'],
    description: (level) => `${level * 8}% fire/lava reduction`,
  },
  blast_protection: {
    displayName: 'Blast Protection', maxLevel: 4, appliesTo: ['armor'],
    description: (level) => `${level * 8}% explosion reduction`,
  },
  projectile_protection: {
    displayName: 'Projectile Protection', maxLevel: 4, appliesTo: ['armor'],
    description: (level) => `${level * 8}% projectile reduction`,
  },
  thorns: {
    displayName: 'Thorns', maxLevel: 3, appliesTo: ['armor'],
    description: (level) => `${EnchantSystem.getThornsChance(level) * 100}% chance to reflect damage`,
  },
  feather_falling: {
    displayName: 'Feather Falling', maxLevel: 4, appliesTo: ['armor'],
    description: (level) => `Reduces fall damage by ${Math.round(EnchantSystem.getFeatherFallingReduction(level) * 100)}%`,
  },
  respiration: {
    displayName: 'Respiration', maxLevel: 3, appliesTo: ['armor'],
    description: (level) => `Extends underwater breathing by ${level * 100}%`,
  },
  depth_strider: {
    displayName: 'Depth Strider', maxLevel: 3, appliesTo: ['armor'],
    description: (level) => `+${level * 33}% swim speed`,
  },
  unbreaking: {
    displayName: 'Unbreaking', maxLevel: 3, appliesTo: ['breakable'],
    description: (level) => `${Math.round((1 - EnchantSystem.getDurabilityUseChance(level)) * 100)}% chance to avoid durability loss`,
  },
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

export const EnchantSystem = {
  getDefinition(id: EnchantmentId) {
    return ENCHANTMENT_DEFS[id];
  },

  getDisplayName(enchantment: Enchantment): string {
    const def = ENCHANTMENT_DEFS[enchantment.id];
    return `${def.displayName} ${ROMAN[enchantment.level] ?? enchantment.level}`;
  },

  canEnchantItem(item: ItemStack | null): boolean {
    return this.getApplicableEnchantments(item).length > 0;
  },

  getApplicableEnchantments(item: ItemStack | null): EnchantmentId[] {
    if (!item) return [];
    const itemDef = ItemRegistry.get(item.id);
    if (!itemDef) return [];

    const categories = new Set<EnchantCategory>();
    if (itemDef.category === 'armor') {
      categories.add('armor');
      categories.add('breakable');
    }
    if (itemDef.category === 'tool') {
      categories.add('breakable');
      if (itemDef.toolType === 'sword') categories.add('sword');
      else if (itemDef.toolType === 'bow') categories.add('bow');
      else categories.add('tool');
    }

    return (Object.keys(ENCHANTMENT_DEFS) as EnchantmentId[]).filter((id) =>
      ENCHANTMENT_DEFS[id].appliesTo.some((category) => categories.has(category))
    );
  },

  getOptions(item: ItemStack | null, playerLevel: number): EnchantOption[] {
    const applicable = this.getApplicableEnchantments(item);
    if (!item || applicable.length === 0) return [];

    return [1, 2, 3].map((cost, index) => {
      const id = applicable[(item.id + index + (item.enchantments?.length ?? 0)) % applicable.length];
      const def = ENCHANTMENT_DEFS[id];
      const currentLevel = this.getLevel(item, id);
      const level = Math.min(def.maxLevel, Math.max(1, currentLevel + cost));
      const enchantment = { id, level };
      return {
        enchantment,
        cost,
        label: this.getDisplayName(enchantment),
        description: def.description(level),
      };
    }).filter((option, index, options) =>
      options.findIndex((other) => other.enchantment.id === option.enchantment.id) === index &&
      this.getLevel(item, option.enchantment.id) < ENCHANTMENT_DEFS[option.enchantment.id].maxLevel &&
      (playerLevel >= option.cost || playerLevel < 0)
    );
  },

  apply(item: ItemStack, enchantment: Enchantment): ItemStack {
    const enchantments = [...(item.enchantments ?? [])];
    const existing = enchantments.find((entry) => entry.id === enchantment.id);
    const maxLevel = ENCHANTMENT_DEFS[enchantment.id].maxLevel;

    if (existing) {
      existing.level = Math.min(maxLevel, Math.max(existing.level, enchantment.level));
    } else {
      enchantments.push({
        id: enchantment.id,
        level: Math.min(maxLevel, Math.max(1, enchantment.level)),
      });
    }

    return {
      ...item,
      enchantments: enchantments.sort((a, b) => a.id.localeCompare(b.id)),
    };
  },

  mergeEnchantments(primary: ItemStack, secondary: ItemStack | null): Enchantment[] {
    const merged = [...(primary.enchantments ?? [])].map((entry) => ({ ...entry }));
    if (!secondary?.enchantments) return merged;

    for (const enchantment of secondary.enchantments) {
      const existing = merged.find((entry) => entry.id === enchantment.id);
      const maxLevel = ENCHANTMENT_DEFS[enchantment.id].maxLevel;
      if (!existing) {
        merged.push({ ...enchantment });
      } else if (existing.level === enchantment.level) {
        existing.level = Math.min(maxLevel, existing.level + 1);
      } else {
        existing.level = Math.min(maxLevel, Math.max(existing.level, enchantment.level));
      }
    }

    return merged.sort((a, b) => a.id.localeCompare(b.id));
  },

  getLevel(item: ItemStack | null | undefined, id: EnchantmentId): number {
    return item?.enchantments?.find((entry) => entry.id === id)?.level ?? 0;
  },

  /** Highest level of an enchantment across all armor pieces. */
  getArmorLevel(armor: Array<ItemStack | null> | undefined, id: EnchantmentId): number {
    if (!armor) return 0;
    return armor.reduce((max, item) => Math.max(max, this.getLevel(item, id)), 0);
  },

  // ─── Combat values (Java 1.20.1) ───
  getSharpnessBonus(level: number): number {
    return level > 0 ? 1 + level * 0.5 : 0;
  },
  getSmiteBonus(level: number): number {
    return level > 0 ? 2.5 * level : 0;
  },
  getFireTicks(level: number): number {
    return 4 * level;
  },
  getPowerMultiplier(level: number): number {
    return level > 0 ? 1 + 0.25 * level : 1;
  },
  getThornsChance(level: number): number {
    return Math.min(0.45, level * 0.15);
  },
  getThornsDamage(level: number): number {
    return level >= 2 ? 2 : 1;
  },

  // ─── Tool values ───
  getEfficiencyMultiplier(level: number): number {
    return level > 0 ? 1 + level * 0.35 : 1;
  },
  getFortuneRolls(level: number): number {
    return level;
  },
  hasSilkTouch(item: ItemStack | null | undefined): boolean {
    return this.getLevel(item, 'silk_touch') > 0;
  },

  // ─── Armor values ───
  getProtectionReduction(level: number): number {
    return Math.min(0.32, level * 0.04);
  },
  getFireProtectionReduction(level: number): number {
    return Math.min(0.64, level * 0.08);
  },
  getBlastProtectionReduction(level: number): number {
    return Math.min(0.64, level * 0.08);
  },
  getProjectileProtectionReduction(level: number): number {
    return Math.min(0.64, level * 0.08);
  },
  getFeatherFallingReduction(level: number): number {
    return Math.min(0.8, level * 0.12);
  },

  // ─── Utility ───
  getDurabilityUseChance(level: number): number {
    return level > 0 ? 1 / (level + 1) : 1;
  },
  shouldUseDurability(item: ItemStack | null | undefined): boolean {
    const level = this.getLevel(item, 'unbreaking');
    return Math.random() < this.getDurabilityUseChance(level);
  },
};
