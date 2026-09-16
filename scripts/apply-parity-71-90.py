from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


def replace_between(path: str, start_marker: str, end_marker: str, replacement: str) -> None:
    p = Path(path)
    text = p.read_text()
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"{path}: start marker not found: {start_marker!r}")
    if text.find(start_marker, start + 1) >= 0:
        raise SystemExit(f"{path}: start marker is not unique: {start_marker!r}")
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"{path}: end marker not found after start: {end_marker!r}")
    p.write_text(text[:start] + replacement + text[end:])


# ---------------------------------------------------------------------------
# EnchantSystem: Quick Charge is a crossbow-only table enchantment; Mending
# remains treasure-only.
# ---------------------------------------------------------------------------
replace_once(
    "src/systems/EnchantSystem.ts",
    "  | 'sharpness' | 'efficiency' | 'protection' | 'unbreaking' | 'mending'\n",
    "  | 'sharpness' | 'efficiency' | 'protection' | 'unbreaking' | 'mending' | 'quick_charge'\n",
)
replace_once(
    "src/systems/EnchantSystem.ts",
    "type EnchantCategory = 'weapon' | 'sword' | 'bow' | 'tool' | 'armor' | 'breakable';",
    "type EnchantCategory = 'weapon' | 'sword' | 'bow' | 'crossbow' | 'tool' | 'armor' | 'breakable';",
)
replace_once(
    "src/systems/EnchantSystem.ts",
    "  efficiency: {\n    displayName: 'Efficiency', maxLevel: 5, appliesTo: ['tool'],",
    "  quick_charge: {\n    displayName: 'Quick Charge', maxLevel: 3, appliesTo: ['crossbow'],\n    description: (level) => `Reduces crossbow load time by ${level * 0.25}s`,\n  },\n  efficiency: {\n    displayName: 'Efficiency', maxLevel: 5, appliesTo: ['tool'],",
)
replace_once(
    "src/systems/EnchantSystem.ts",
    "      if (itemDef.toolType === 'sword') categories.add('sword');\n      else if (itemDef.toolType === 'bow') categories.add('bow');\n      else categories.add('tool');",
    "      if (itemDef.toolType === 'sword') categories.add('sword');\n      else if (itemDef.toolType === 'bow') categories.add('bow');\n      else if (itemDef.toolType === 'crossbow') categories.add('crossbow');\n      else categories.add('tool');",
)


# ---------------------------------------------------------------------------
# Game runtime wiring for shield timing/durability, hurt cooldown, Mending,
# melee durability costs, and ranged timing.
# ---------------------------------------------------------------------------
replace_once(
    "src/engine/Game.ts",
    "import { applyDamageProtection, baseArmorApplies } from '../systems/DamageRules';\n",
    "import { applyDamageProtection, baseArmorApplies, type PlayerDamageKind } from '../systems/DamageRules';\n"
    "import {\n"
    "  SHIELD_MOVEMENT_MULTIPLIER,\n"
    "  getBlockedShieldDurabilityDamage,\n"
    "  isShieldBlockActive,\n"
    "  shieldCanBlockDamage,\n"
    "  shieldFacesSource,\n"
    "} from '../systems/ShieldRules';\n"
    "import { createHurtCooldownState, resolveHurtDamage, tickHurtCooldown } from '../systems/HurtCooldown';\n"
    "import { getMeleeDurabilityCost } from '../systems/DurabilityRules';\n"
    "import {\n"
    "  BOW_FULL_CHARGE_SECONDS,\n"
    "  canReleaseBow,\n"
    "  getBowPower as getJavaBowPower,\n"
    "  getCrossbowChargeSeconds,\n"
    "} from '../systems/RangedRules';\n",
)
replace_once(
    "src/engine/Game.ts",
    "const SHIELD_MAX_DURABILITY = 336;\nconst BOW_FULL_CHARGE_TIME = 1.0;\nconst BOW_MIN_RELEASE_TIME = 0.15;\nconst BOW_BASE_DAMAGE = 6;\nconst BOW_MIN_SPEED = 7;\nconst BOW_MAX_SPEED = 30;\nconst CROSSBOW_CHARGE_TIME = 1.25;",
    "const SHIELD_MAX_DURABILITY = 336;\nconst BOW_BASE_DAMAGE = 6;\nconst BOW_MIN_SPEED = 7;\nconst BOW_MAX_SPEED = 30;",
)
replace_once(
    "src/engine/Game.ts",
    "  private isShieldBlocking = false;\n  private bowChargeTimer = 0;",
    "  private isShieldBlocking = false;\n  private shieldUseTimer = 0;\n  private shieldDisableTimer = 0;\n  private hurtCooldown = createHurtCooldownState();\n  private bowChargeTimer = 0;",
)
replace_once(
    "src/engine/Game.ts",
    "    this.lockCooldown = Math.max(0, this.lockCooldown - dt);\n    this.spawnProtectionTimer = Math.max(0, this.spawnProtectionTimer - dt);\n    this.updateFishingBobber(dt);",
    "    this.lockCooldown = Math.max(0, this.lockCooldown - dt);\n    this.spawnProtectionTimer = Math.max(0, this.spawnProtectionTimer - dt);\n    this.shieldDisableTimer = Math.max(0, this.shieldDisableTimer - dt);\n    this.hurtCooldown = tickHurtCooldown(this.hurtCooldown, dt);\n    this.updateFishingBobber(dt);",
)
replace_once(
    "src/engine/Game.ts",
    "    this.updateShieldBlockingState();\n    this.player.speedMultiplier = this.potionEffects.getSpeedMultiplier() * (this.isShieldBlocking ? 0.35 : 1.0);",
    "    this.updateShieldBlockingState(dt);\n    this.player.speedMultiplier = this.potionEffects.getSpeedMultiplier() * (this.isShieldBlocking ? SHIELD_MOVEMENT_MULTIPLIER : 1.0);",
)
replace_between(
    "src/engine/Game.ts",
    "  private updateShieldBlockingState() {",
    "  private isBowStack(",
    """  private updateShieldBlockingState(dt: number) {
    const selected = this.inventory.getSlot(this.player.selectedSlot);
    const wantsToBlock = !this.bowChargeActive &&
      !this.isBowStack(selected) &&
      !this.chatOpen &&
      this.openUI === 'none' &&
      this.input.isMouseDown(2) &&
      this.shieldDisableTimer <= 0 &&
      this.getActiveShieldSlot() !== null;

    if (wantsToBlock) {
      this.shieldUseTimer += dt;
    } else {
      this.shieldUseTimer = 0;
    }

    if (wantsToBlock !== this.isShieldBlocking) {
      this.isShieldBlocking = wantsToBlock;
      this.notifyState();
    }
  }

""",
)
replace_between(
    "src/engine/Game.ts",
    "  private damageActiveShield(amount: number) {",
    "  private canShieldBlock(",
    """  private damageActiveShield(amount: number) {
    if (this.gameMode === 'creative') return;
    const shield = this.getActiveShieldSlot();
    if (!shield) return;

    const durabilityCost = getBlockedShieldDurabilityDamage(amount);
    if (durabilityCost <= 0) return;

    shield.stack.durability ??= SHIELD_MAX_DURABILITY;
    for (let point = 0; point < durabilityCost; point++) {
      if (!EnchantSystem.shouldUseDurability(shield.stack)) continue;
      shield.stack.durability -= 1;
      if (shield.stack.durability <= 0) break;
    }

    if (shield.stack.durability <= 0) {
      if (shield.source === 'mainhand') {
        this.inventory.setSlot(this.player.selectedSlot, null);
      } else {
        this.inventory.setOffhand(null);
      }
      this.isShieldBlocking = false;
      this.shieldUseTimer = 0;
      this.sound.playBlockBreak(5);
    }
  }

""",
)
replace_between(
    "src/engine/Game.ts",
    "  private canShieldBlock(",
    "  damagePlayer(\n",
    """  private canShieldBlock(type: PlayerDamageKind, knockback?: THREE.Vector3): boolean {
    if (!shieldCanBlockDamage(type)) return false;
    if (!isShieldBlockActive(this.shieldUseTimer, this.shieldDisableTimer)) return false;
    if (!knockback || knockback.lengthSq() === 0) return false;
    const facing = this.player.forward.clone().setY(0);
    const sourceToPlayer = knockback.clone().setY(0);
    if (facing.lengthSq() === 0 || sourceToPlayer.lengthSq() === 0) return false;
    return shieldFacesSource(facing.x, facing.z, sourceToPlayer.x, sourceToPlayer.z);
  }

""",
)
replace_once(
    "src/engine/Game.ts",
    "    type: 'mob' | 'projectile' | 'fall' | 'drown' | 'starve' | 'wither' | 'magic' | 'fire' | 'lava' | 'explosion',",
    "    type: PlayerDamageKind,",
)
# Thorns must not trigger on a shielded or hurt-cooldown-rejected hit.
thorns_block = """    // P3.3: Thorns reflects damage back to the attacking mob.
    if (attacker && (type === 'mob' || type === 'projectile')) {
      const thornsLevel = this.inventory.armor.reduce((max, item) => Math.max(max, EnchantSystem.getLevel(item, 'thorns')), 0);
      if (thornsLevel > 0 && Math.random() < EnchantSystem.getThornsChance(thornsLevel)) {
        attacker.takeDamage(EnchantSystem.getThornsDamage(thornsLevel));
      }
    }

"""
replace_once("src/engine/Game.ts", thorns_block, "")
replace_once(
    "src/engine/Game.ts",
    "    if (type === 'mob' && this.canShieldBlock(knockback)) {",
    "    if (this.canShieldBlock(type, knockback)) {",
)
replace_once(
    "src/engine/Game.ts",
    "      if (knockback) {\n        this.player.velocity.add(knockback.clone().multiplyScalar(0.25));\n      }",
    "      // Direct melee/projectiles lose their knockback when blocked;\n      // explosions retain only the project's reduced shielded impulse.\n      if (type === 'explosion' && knockback) {\n        this.player.velocity.add(knockback.clone().multiplyScalar(0.25));\n      }",
)
replace_once(
    "src/engine/Game.ts",
    "    const protectionLevels = this.inventory.armor.reduce((totals, item) => {",
    "    const hurtResult = resolveHurtDamage(this.hurtCooldown, amount);\n"
    "    this.hurtCooldown = hurtResult.next;\n"
    "    if (!hurtResult.accepted || hurtResult.appliedDamage <= 0) return;\n"
    "    const effectiveRawDamage = hurtResult.appliedDamage;\n\n"
    + thorns_block +
    "    const protectionLevels = this.inventory.armor.reduce((totals, item) => {",
)
replace_once(
    "src/engine/Game.ts",
    "    let finalDamage = applyDamageProtection(amount, type, defense, toughness, protectionLevels);",
    "    let finalDamage = applyDamageProtection(effectiveRawDamage, type, defense, toughness, protectionLevels);",
)
replace_once(
    "src/engine/Game.ts",
    "      this.inventory.damageArmor(1);",
    "      this.inventory.damageArmor(effectiveRawDamage);",
)
replace_once(
    "src/engine/Game.ts",
    "        () => this.notifyState()\n      );\n\n      // Resolve collisions (mob-mob, player-mob)",
    "        () => this.notifyState(),\n        (amount) => this.inventory.repairWithMendingXP(this.player.selectedSlot, amount)\n      );\n\n      // Resolve collisions (mob-mob, player-mob)",
)
replace_between(
    "src/engine/Game.ts",
    "  private getBowPower(chargeTime: number): number {",
    "  private getItemInteractionContext(",
    """  private getBowPower(chargeTime: number): number {
    return getJavaBowPower(chargeTime);
  }

""",
)
replace_once(
    "src/engine/Game.ts",
    "    if (!stillHoldingBow || chargeTime < BOW_MIN_RELEASE_TIME || !this.canUseBow()) {",
    "    if (!stillHoldingBow || !canReleaseBow(chargeTime) || !this.canUseBow()) {",
)
replace_once(
    "src/engine/Game.ts",
    "      continueUse: ({ stack }, progress) => {\n        this.bowChargeTimer = progress.elapsedSeconds / CROSSBOW_CHARGE_TIME * BOW_FULL_CHARGE_TIME;\n        if (progress.elapsedSeconds < CROSSBOW_CHARGE_TIME) return { handled: true };",
    "      continueUse: ({ stack }, progress) => {\n        const chargeTime = getCrossbowChargeSeconds(EnchantSystem.getLevel(stack, 'quick_charge'));\n        this.bowChargeTimer = chargeTime <= 0\n          ? BOW_FULL_CHARGE_SECONDS\n          : progress.elapsedSeconds / chargeTime * BOW_FULL_CHARGE_SECONDS;\n        if (progress.elapsedSeconds < chargeTime) return { handled: true };",
)
replace_once(
    "src/engine/Game.ts",
    "              if (heldItemStack && ItemRegistry.isTool(heldItemStack.id)) {\n                this.inventory.damageTool(this.player.selectedSlot);\n              }",
    "              if (heldItemStack && ItemRegistry.isTool(heldItemStack.id)) {\n                const heldDef = ItemRegistry.get(heldItemStack.id);\n                const meleeDurabilityCost = getMeleeDurabilityCost(heldDef?.toolType);\n                if (meleeDurabilityCost > 0) {\n                  this.inventory.damageTool(this.player.selectedSlot, meleeDurabilityCost);\n                }\n              }",
)
