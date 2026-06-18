import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';

export type EnchantmentId = 'sharpness' | 'efficiency' | 'protection' | 'unbreaking';

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

const ENCHANTMENT_DEFS: Record<EnchantmentId, {
  displayName: string;
  maxLevel: number;
  appliesTo: Array<'weapon' | 'tool' | 'armor' | 'breakable'>;
  description: (level: number) => string;
}> = {
  sharpness: {
    displayName: 'Sharpness',
    maxLevel: 5,
    appliesTo: ['weapon'],
    description: (level) => `+${EnchantSystem.getSharpnessBonus(level)} melee damage`,
  },
  efficiency: {
    displayName: 'Efficiency',
    maxLevel: 5,
    appliesTo: ['tool'],
    description: (level) => `${Math.round((EnchantSystem.getEfficiencyMultiplier(level) - 1) * 100)}% faster mining`,
  },
  protection: {
    displayName: 'Protection',
    maxLevel: 4,
    appliesTo: ['armor'],
    description: (level) => `${level * 4}% extra damage reduction`,
  },
  unbreaking: {
    displayName: 'Unbreaking',
    maxLevel: 3,
    appliesTo: ['breakable'],
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

    const categories = new Set<'weapon' | 'tool' | 'armor' | 'breakable'>();
    if (itemDef.category === 'armor') {
      categories.add('armor');
      categories.add('breakable');
    }
    if (itemDef.category === 'tool') {
      categories.add('breakable');
      if (itemDef.toolType === 'sword') {
        categories.add('weapon');
      } else {
        categories.add('tool');
      }
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

  getSharpnessBonus(level: number): number {
    return level > 0 ? 1 + level * 0.5 : 0;
  },

  getEfficiencyMultiplier(level: number): number {
    return level > 0 ? 1 + level * 0.35 : 1;
  },

  getProtectionReduction(level: number): number {
    return Math.min(0.32, level * 0.04);
  },

  getDurabilityUseChance(level: number): number {
    return level > 0 ? 1 / (level + 1) : 1;
  },

  shouldUseDurability(item: ItemStack | null | undefined): boolean {
    const level = this.getLevel(item, 'unbreaking');
    return Math.random() < this.getDurabilityUseChance(level);
  },
};
