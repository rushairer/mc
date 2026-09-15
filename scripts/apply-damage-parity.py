from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


# Inventory: expose equipped armor toughness alongside defense.
replace_once(
    "src/player/Inventory.ts",
    "import { EnchantSystem } from '../systems/EnchantSystem';\n",
    "import { EnchantSystem } from '../systems/EnchantSystem';\nimport { getArmorToughness } from '../items/ArmorAttributes';\n",
)
marker = "  /** Damage equipped armor items. */\n"
p = Path("src/player/Inventory.ts")
text = p.read_text()
if text.count(marker) != 1:
    raise SystemExit("Inventory.ts: damageArmor marker is not unique")
toughness_method = """  /** Get total Java armor toughness from equipped pieces. */
  getTotalArmorToughness(): number {
    if (!this.armor || !Array.isArray(this.armor)) {
      this.armor = new Array(ARMOR_SLOTS).fill(null);
    }
    let total = 0;
    for (const item of this.armor) {
      if (!item) continue;
      total += getArmorToughness(ItemRegistry.get(item.id)?.name);
    }
    return total;
  }

"""
p.write_text(text.replace(marker, toughness_method + marker, 1))

# Game: route player damage through the Java armor/toughness/EPF pipeline.
replace_once(
    "src/engine/Game.ts",
    "import { calculateMeleeDamage, getSweepDamage, isChargedMeleeAttack } from '../systems/CombatRules';\n",
    "import { calculateMeleeDamage, getSweepDamage, isChargedMeleeAttack } from '../systems/CombatRules';\nimport { applyDamageProtection, baseArmorApplies } from '../systems/DamageRules';\n",
)

game_path = Path("src/engine/Game.ts")
game = game_path.read_text()
start_marker = "    // P3.3: Resistance effect reduces all damage (20% per level).\n"
end_marker = "    // P3.3: Absorption absorbs damage before health.\n"
start = game.find(start_marker)
end = game.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("Game.ts: damage mitigation block markers not found")
if game.find(start_marker, start + 1) >= 0:
    raise SystemExit("Game.ts: damage mitigation start marker is not unique")

replacement = """    const protectionLevels = this.inventory.armor.reduce((totals, item) => {
      totals.protection += EnchantSystem.getLevel(item, 'protection');
      totals.fireProtection += EnchantSystem.getLevel(item, 'fire_protection');
      totals.blastProtection += EnchantSystem.getLevel(item, 'blast_protection');
      totals.projectileProtection += EnchantSystem.getLevel(item, 'projectile_protection');
      totals.featherFalling += EnchantSystem.getLevel(item, 'feather_falling');
      return totals;
    }, {
      protection: 0,
      fireProtection: 0,
      blastProtection: 0,
      projectileProtection: 0,
      featherFalling: 0,
    });

    const defense = this.inventory.getTotalArmorDefense();
    const toughness = this.inventory.getTotalArmorToughness();
    let finalDamage = applyDamageProtection(amount, type, defense, toughness, protectionLevels);

    // Starvation is tagged bypasses_effects in Java; other project damage kinds
    // are reduced by Resistance after the armor-dependent calculation.
    if (type !== 'starve') {
      finalDamage *= 1 - PotionEffects.getResistanceReduction(this.potionEffects.getLevel('resistance'));
    }

    if (baseArmorApplies(type) && defense > 0 && finalDamage > 0) {
      this.inventory.damageArmor(1);
    }

"""
game_path.write_text(game[:start] + replacement + game[end:])
