from pathlib import Path

path = Path('src/server/GameServer.ts')
source = path.read_text()

def replace_once(old: str, new: str, label: str):
    global source
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, got {count}')
    source = source.replace(old, new, 1)

replace_once(
    "import { canExecuteServerCommand, clampGiveCount, isValidWeatherArgument } from './ServerCommandRules';",
    "import { applyGiveToInventory, canExecuteServerCommand, isValidWeatherArgument, validateGiveCount } from './ServerCommandRules';\nimport { getProjectileImpactBehavior } from './ServerProjectileRules';",
    'command/projectile imports',
)

replace_once(
    "        if (applied > 0) {\n          const resistance = getNetheriteKnockbackResistance(target.armor);\n          this.applyMeleeKnockbackToPlayer(session, target, applyKnockbackResistance(knockback.strength, resistance));\n        }\n        if (knockback.sprintKnockback) session.sprinting = false;\n        break;",
    "        if (applied > 0) {\n          const resistance = getNetheriteKnockbackResistance(target.armor);\n          this.applyMeleeKnockbackToPlayer(session, target, applyKnockbackResistance(knockback.strength, resistance));\n        }\n        // Java 26.3 RC3 (MC-311799): sprint-hitting another player no longer\n        // slows/cancels sprint on the attacker. Mob hits keep their legacy path.\n        break;",
    'PvP sprint retention',
)

old_give = """      case 'give': {
        if (args.length >= 1) {
          const itemId = parseInt(args[0]);
          const def = ItemRegistry.get(itemId);
          const count = def ? clampGiveCount(args[1] ?? def.maxStackSize, def.maxStackSize) : null;
          if (!def || count === null) break;

          // Find empty slot or matching slot
          let added = false;
          for (let i = 0; i < 36; i++) {
            const slot = session.inventory[i];
            if (!slot) {
              session.inventory[i] = { id: itemId, count };
              added = true;
              break;
            } else if (slot.id === itemId && slot.count + count <= def.maxStackSize) {
              slot.count += count;
              added = true;
              break;
            }
          }

          if (added) {
            this.sendTo(session, PacketType.S2C_INVENTORY_SYNC, { slots: session.inventory, armor: session.armor, offhand: session.offhand });
            this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: `Gave ${count} of ${itemId}` });
          } else {
            this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: `Inventory full.` });
          }
        }
        break;
      }"""
new_give = """      case 'give': {
        if (args.length >= 1) {
          const itemId = parseInt(args[0]);
          const def = ItemRegistry.get(itemId);
          const count = def ? validateGiveCount(args[1], def.maxStackSize) : null;
          if (!def || count === null) {
            this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: 'Invalid /give item or amount (maximum 100 stacks).' });
            break;
          }

          const result = applyGiveToInventory(session.inventory, itemId, count, def.maxStackSize);
          session.inventory = result.slots;
          let remainder = result.remainder;
          while (remainder > 0) {
            const dropped = Math.min(remainder, def.maxStackSize);
            this.spawnDroppedStack({ id: itemId, count: dropped }, session.x, session.y + 0.5, session.z, session.dimension, 0);
            remainder -= dropped;
          }
          this.syncPlayerInventory(session);
          this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: `Gave ${count} of ${itemId}` });
        }
        break;
      }"""
replace_once(old_give, new_give, 'give command')

old_time = """      case 'time': {
        if (args[0] === 'set' && args[1]) {
          const presets: Record<string, number> = { day: 1000, noon: 6000, night: 13000, midnight: 18000 };
          const raw = presets[args[1]] ?? Number(args[1]);
          if (Number.isFinite(raw)) {
            const ticks = ((Math.floor(raw) % 24000) + 24000) % 24000;
            this.gameTime = ticks / 24000;
            this.broadcast(PacketType.S2C_TIME, { gameTime: this.gameTime });
            this.sendSystemMessage(`Set time to ${args[1]}`);
          }
        }
        break;
      }"""
new_time = """      case 'time': {
        if (args[0] === 'set' && args[1]) {
          const presets: Record<string, number> = { day: 1000, noon: 6000, night: 13000, midnight: 18000 };
          const raw = presets[args[1]] ?? Number(args[1]);
          if (Number.isFinite(raw)) {
            const ticks = ((Math.floor(raw) % 24000) + 24000) % 24000;
            const nextTime = ticks / 24000;
            if (Math.abs(nextTime - this.gameTime) <= Number.EPSILON) {
              this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: `Time already equals ${args[1]}` });
              break;
            }
            this.gameTime = nextTime;
            this.broadcast(PacketType.S2C_TIME, { gameTime: this.gameTime });
            this.sendSystemMessage(`Set time to ${args[1]}`);
          }
        }
        break;
      }"""
replace_once(old_time, new_time, 'time no-op command')

marker = """  private tickProjectiles(dt: number) {
"""
helper = """  private resolveEnderPearlImpact(proj: ServerProjectile): boolean {
    const behavior = getProjectileImpactBehavior(proj.type);
    if (!behavior.teleportsOwner) return false;

    const owner = proj.ownerId ? this.players.get(proj.ownerId) : undefined;
    if (owner && owner.dimension === proj.dimension) {
      owner.x = proj.position.x;
      owner.y = proj.position.y;
      owner.z = proj.position.z;
      owner.onGround = false;
      owner.descending = false;
      owner.sprinting = false;

      this.sendTo(owner, PacketType.S2C_POSITION_CORRECTION, {
        x: owner.x, y: owner.y, z: owner.z, yaw: owner.yaw, pitch: owner.pitch,
      });
      if (behavior.resetsOwnerMomentum) {
        this.sendTo(owner, PacketType.S2C_PLAYER_VELOCITY, { x: 0, y: 0, z: 0 });
      }
      if (behavior.ownerDamage > 0) {
        this.applyServerDamageToPlayer(owner, behavior.ownerDamage, 'fall', proj.position, false);
      }
      this.broadcastDimension(owner.dimension, PacketType.S2C_PLAYER_MOVE, {
        id: owner.id, x: owner.x, y: owner.y, z: owner.z, yaw: owner.yaw, pitch: owner.pitch,
      });
      this.broadcastDimension(owner.dimension, PacketType.S2C_SOUND, {
        type: 'ender_pearl_teleport', x: owner.x, y: owner.y, z: owner.z,
      });
    }

    this.projectiles.delete(proj.id);
    this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
    return true;
  }

  private tickProjectiles(dt: number) {
"""
replace_once(marker, helper, 'ender pearl helper insertion')

replace_once(
    """      const hitBlock = this.isSolidBlock(px, py, pz, proj.dimension);
      if (hitBlock) {
        this.projectiles.delete(proj.id);
        this.broadcast(PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
        this.broadcast(PacketType.S2C_SOUND, { type: 'bow_hit', x: proj.position.x, y: proj.position.y, z: proj.position.z });
        continue;
      }""",
    """      const hitBlock = this.isSolidBlock(px, py, pz, proj.dimension);
      if (hitBlock) {
        if (this.resolveEnderPearlImpact(proj)) continue;
        this.projectiles.delete(proj.id);
        this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
        this.broadcastDimension(proj.dimension, PacketType.S2C_SOUND, { type: 'bow_hit', x: proj.position.x, y: proj.position.y, z: proj.position.z });
        continue;
      }""",
    'projectile block impact',
)

replace_once(
    """          if (proj.position.distanceTo(pPos) < 1.0) {
            this.applyServerDamageToPlayer(player, proj.damage, 'projectile', proj.position, false);
            this.projectiles.delete(proj.id);
            this.broadcast(PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
            hitSomeone = true;
            break;
          }""",
    """          if (proj.position.distanceTo(pPos) < 1.0) {
            if (this.resolveEnderPearlImpact(proj)) {
              hitSomeone = true;
              break;
            }
            this.applyServerDamageToPlayer(player, proj.damage, 'projectile', proj.position, false);
            this.projectiles.delete(proj.id);
            this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
            hitSomeone = true;
            break;
          }""",
    'projectile player impact',
)

replace_once(
    """          if (proj.position.distanceTo(mPos) < 0.8) {
            mob.health -= proj.damage;""",
    """          if (proj.position.distanceTo(mPos) < 0.8) {
            if (this.resolveEnderPearlImpact(proj)) {
              hitSomeone = true;
              break;
            }
            mob.health -= proj.damage;""",
    'projectile mob impact',
)

# Scope projectile state packets to the projectile's dimension. Exact strings
# are confined to spawn/tick paths by their local variable names.
source = source.replace(
    "this.broadcast(PacketType.S2C_PROJECTILE_SPAWN, {",
    "this.broadcastDimension(projectile.dimension, PacketType.S2C_PROJECTILE_SPAWN, {",
)
source = source.replace(
    "this.broadcast(PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });",
    "this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });",
)
source = source.replace(
    "this.broadcast(PacketType.S2C_PROJECTILE_MOVE, {",
    "this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_MOVE, {",
)

path.write_text(source)
print('parity 271-290 runtime patch applied')
