export type CombatToolType =
  | 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe' | 'spear'
  | 'bow' | 'crossbow' | 'fishing_rod' | 'trident' | 'mace' | 'brush';

export type CombatToolMaterial =
  | 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'copper' | 'netherite';

const AXE_ATTACK_SPEED: Partial<Record<CombatToolMaterial, number>> = {
  wood: 0.8,
  gold: 1.0,
  stone: 0.8,
  iron: 0.9,
  diamond: 1.0,
  netherite: 1.0,
};

const HOE_ATTACK_SPEED: Partial<Record<CombatToolMaterial, number>> = {
  wood: 1.0,
  gold: 1.0,
  stone: 2.0,
  iron: 3.0,
  diamond: 4.0,
  netherite: 4.0,
};

const MATERIAL_INDEX: Partial<Record<CombatToolMaterial, number>> = {
  wood: 0,
  gold: 0,
  stone: 1,
  copper: 1, // project extension: preserve a stone-like fallback outside parity scope
  iron: 2,
  diamond: 3,
  netherite: 4,
};

/** Java Edition 1.20.1 main-hand attack speed attribute. */
export function getAttackSpeed(
  toolType?: CombatToolType,
  material?: CombatToolMaterial,
): number {
  switch (toolType) {
    case 'sword': return 1.6;
    case 'trident': return 1.1;
    case 'shovel': return 1.0;
    case 'pickaxe': return 1.2;
    case 'axe': return AXE_ATTACK_SPEED[material ?? 'wood'] ?? 1.0;
    case 'hoe': return HOE_ATTACK_SPEED[material ?? 'wood'] ?? 1.0;
    // Non-melee tools/items retain the player's generic attack speed.
    case 'spear': return 1.1; // project extension; not part of the 1.20.1 parity set
    default: return 4.0;
  }
}

/** Seconds required for the attack-strength scale to reach 1.0 at 20 TPS. */
export function getAttackCooldownSeconds(
  toolType?: CombatToolType,
  material?: CombatToolMaterial,
): number {
  return 1 / getAttackSpeed(toolType, material);
}

/**
 * Java Edition 1.20.1 total generic.attack_damage while the item is held.
 * Values include the player's base 1 attack damage.
 */
export function getMeleeAttackDamage(
  toolType?: CombatToolType,
  material?: CombatToolMaterial,
): number {
  if (toolType === 'trident') return 9;
  if (!material || MATERIAL_INDEX[material] === undefined) return 1;

  const index = MATERIAL_INDEX[material]!;
  switch (toolType) {
    case 'sword': return 4 + index;
    case 'pickaxe': return 2 + index;
    case 'shovel': return 2.5 + index;
    case 'axe': {
      if (material === 'wood' || material === 'gold') return 7;
      if (material === 'netherite') return 10;
      return 9;
    }
    case 'hoe': return 1;
    default: return 1;
  }
}
