import { readFileSync, writeFileSync } from 'node:fs';

const phase = process.argv[2];
if (phase !== 'combat' && phase !== 'world') {
  throw new Error('usage: node scripts/parity-91-110-runtime.mjs <combat|world>');
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content, 'utf8');
}

function replaceOnce(content, from, to, label) {
  const first = content.indexOf(from);
  if (first < 0) throw new Error(`missing patch target: ${label}`);
  if (content.indexOf(from, first + from.length) >= 0) throw new Error(`ambiguous patch target: ${label}`);
  return content.slice(0, first) + to + content.slice(first + from.length);
}

function replaceRegexOnce(content, pattern, to, label) {
  const matches = [...content.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'))];
  if (matches.length !== 1) throw new Error(`expected one ${label} match, got ${matches.length}`);
  return content.replace(pattern, to);
}

function patchCombat() {
  const serverPath = 'src/server/GameServer.ts';
  let server = read(serverPath);

  server = replaceOnce(
    server,
    "import { getBowReleaseParams, parseItemAction } from './ItemActionRules';",
    `import {\n  getBowReleaseParams,\n  getServerBowPowerLevel,\n  getThrowableProjectileType,\n  isValidItemActionForHeldStack,\n  parseItemAction,\n} from './ItemActionRules';\nimport {\n  getServerMeleeDamage,\n  getServerMeleeProfile,\n  isEntityAttackInReach,\n  parseEntityAttackIntent,\n} from './ServerCombatRules';\nimport {\n  damageDurableStack,\n  damageServerArmorForHit,\n  mitigateServerPlayerDamage,\n  resolveServerShieldBlock,\n} from './ServerPlayerDamage';`,
    'GameServer item/combat imports',
  );

  server = replaceOnce(
    server,
    "import type { ItemStack, BlockMetadata } from '../types';",
    `import type { ItemStack, BlockMetadata } from '../types';\nimport { createHurtCooldownState, resolveHurtDamage, tickHurtCooldown, type HurtCooldownState } from '../systems/HurtCooldown';\nimport type { PlayerDamageKind } from '../systems/DamageRules';`,
    'GameServer hurt imports',
  );

  server = replaceOnce(
    server,
    `  selectedSlot: number;\n  /** P5.2 — guards one-time death handling. */`,
    `  selectedSlot: number;\n  isBlocking: boolean;\n  shieldUseSeconds: number;\n  shieldDisabledSeconds: number;\n  lastAttackTick: number | null;\n  hurtCooldown: HurtCooldownState;\n  healthAuthorityLockSeconds: number;\n  /** P5.2 — guards one-time death handling. */`,
    'PlayerSession authority fields',
  );

  server = replaceOnce(
    server,
    `      offhand: null,\n      selectedSlot: 0\n    };`,
    `      offhand: null,\n      selectedSlot: 0,\n      isBlocking: false,\n      shieldUseSeconds: 0,\n      shieldDisabledSeconds: 0,\n      lastAttackTick: null,\n      hurtCooldown: createHurtCooldownState(),\n      healthAuthorityLockSeconds: 0\n    };`,
    'PlayerSession defaults',
  );

  server = replaceOnce(
    server,
    `  private nextEntityId = 1000;\n  private gameTime = 0.05;`,
    `  private nextEntityId = 1000;\n  private gameTick = 0;\n  private gameTime = 0.05;`,
    'server game tick',
  );

  server = replaceRegexOnce(
    server,
    /      case PacketType\.C2S_INTERACT_ENTITY: \{[\s\S]*?        break;\n      \}\n\n      \/\/ P5\.1: server-authoritative item actions/,
    `      case PacketType.C2S_INTERACT_ENTITY: {\n        const intent = parseEntityAttackIntent(packet.payload);\n        if (!intent) break;\n\n        const held = session.inventory[session.selectedSlot];\n        const profile = getServerMeleeProfile(held);\n        const damage = getServerMeleeDamage(held, session.lastAttackTick, this.gameTick);\n\n        if (typeof intent.entityId === 'number') {\n          const mob = this.mobs.get(intent.entityId);\n          if (!mob || mob.health <= 0 || mob.dimension !== session.dimension) break;\n          if (!isEntityAttackInReach(session, mob.position, 'survival')) break;\n\n          session.lastAttackTick = this.gameTick;\n          mob.health -= damage;\n          mob.hurtTimer = 0.5;\n          this.damageHeldMeleeItem(session, profile.durabilityCost);\n          this.broadcastDimension(session.dimension, PacketType.S2C_MOB_STATE, {\n            id: mob.id,\n            health: mob.health,\n            hurtTimer: mob.hurtTimer\n          });\n          this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {\n            type: 'hit', x: mob.position.x, y: mob.position.y, z: mob.position.z\n          });\n          if (mob.health <= 0) this.handleMobDeath(mob);\n          break;\n        }\n\n        const target = this.players.get(intent.entityId);\n        if (!target || target.id === session.id || target.dimension !== session.dimension) break;\n        if (!isEntityAttackInReach(session, target, 'survival')) break;\n\n        session.lastAttackTick = this.gameTick;\n        this.damageHeldMeleeItem(session, profile.durabilityCost);\n        this.applyServerDamageToPlayer(\n          target,\n          damage,\n          'mob',\n          new THREE.Vector3(session.x, session.y + 1.62, session.z),\n          profile.isAxe,\n        );\n        break;\n      }\n\n      // P5.1: server-authoritative item actions`,
    'C2S_INTERACT_ENTITY',
  );

  server = replaceRegexOnce(
    server,
    /      case PacketType\.C2S_ITEM_ACTION: \{[\s\S]*?        break;\n      \}\n\n      \/\/ P5\.2: client uploads its simulated state/,
    `      case PacketType.C2S_ITEM_ACTION: {\n        const request = parseItemAction(packet.payload);\n        if (!request) break;\n        const held = session.inventory[session.selectedSlot];\n        if (!isValidItemActionForHeldStack(request, held)) break;\n\n        const origin = new THREE.Vector3(session.x, session.y + 1.6, session.z);\n        const dir = new THREE.Vector3(request.direction.x, request.direction.y, request.direction.z);\n\n        if (request.action === 'bow_release') {\n          const ammoSlot = session.inventory.findIndex((slot) => slot && (slot.id & 0x3FF) === 262);\n          if (ammoSlot < 0) break;\n          const ammo = session.inventory[ammoSlot]!;\n          ammo.count -= 1;\n          if (ammo.count <= 0) session.inventory[ammoSlot] = null;\n\n          const params = getBowReleaseParams(request.power ?? 0, getServerBowPowerLevel(held));\n          session.inventory[session.selectedSlot] = damageDurableStack(held, 1, 'tool');\n          this.spawnProjectile(session, 'arrow', origin, dir.multiplyScalar(params.speed), {\n            damage: params.damage,\n            velocityY: 0.5,\n          });\n          this.syncPlayerInventory(session);\n          this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {\n            type: 'bow_shoot', x: origin.x, y: origin.y, z: origin.z\n          });\n          break;\n        }\n\n        const type = getThrowableProjectileType(held!.id);\n        if (!type) break;\n        const potionEffect = type === 'potion' ? held?.potion?.effect : undefined;\n        this.spawnProjectile(session, type, origin, dir.multiplyScalar(15), {\n          damage: type === 'trident' ? 9 : 1,\n          velocityY: 2.5,\n          potionEffect,\n        });\n        if (type === 'trident') {\n          session.inventory[session.selectedSlot] = damageDurableStack(held, 1, 'tool');\n        } else {\n          session.inventory[session.selectedSlot] = consumeOne(held!);\n        }\n        this.syncPlayerInventory(session);\n        break;\n      }\n\n      // P5.2: client uploads its simulated state`,
    'C2S_ITEM_ACTION',
  );

  server = replaceOnce(
    server,
    `      case PacketType.C2S_PLAYER_STATE: {\n        const clamped = clampPlayerState(packet.payload);\n        session.health = clamped.health;\n        session.hunger = clamped.hunger;\n        session.oxygen = clamped.oxygen;\n        break;\n      }`,
    `      case PacketType.C2S_PLAYER_STATE: {\n        const clamped = clampPlayerState(packet.payload);\n        session.isBlocking = packet.payload?.blocking === true;\n        session.health = session.healthAuthorityLockSeconds > 0\n          ? Math.min(session.health, clamped.health)\n          : clamped.health;\n        session.hunger = clamped.hunger;\n        session.oxygen = clamped.oxygen;\n        break;\n      }`,
    'C2S_PLAYER_STATE authority lock',
  );

  const helpers = `\n  private syncPlayerInventory(player: PlayerSession) {\n    this.sendTo(player, PacketType.S2C_INVENTORY_SYNC, {\n      slots: player.inventory,\n      armor: player.armor,\n      offhand: player.offhand,\n    });\n  }\n\n  private syncPlayerState(player: PlayerSession) {\n    const nextRequirement = this.getXpRequirement(player.xpLevel);\n    this.sendTo(player, PacketType.S2C_PLAYER_STATE, {\n      health: player.health,\n      hunger: player.hunger,\n      oxygen: player.oxygen,\n      level: player.xpLevel,\n      xpProgress: nextRequirement > 0 ? player.xpCurrent / nextRequirement : 0,\n    });\n  }\n\n  private getXpRequirement(level: number): number {\n    if (level < 15) return 7 + 2 * level;\n    if (level < 30) return 37 + 5 * (level - 15);\n    return 112 + 9 * (level - 30);\n  }\n\n  private getBlockingShieldSlot(player: PlayerSession): { kind: 'offhand' | 'hotbar'; index: number; stack: ItemStack } | null {\n    const offhand = player.offhand;\n    if (offhand && ItemRegistry.get(offhand.id)?.name === 'shield') {\n      return { kind: 'offhand', index: -1, stack: offhand };\n    }\n    const held = player.inventory[player.selectedSlot];\n    if (held && ItemRegistry.get(held.id)?.name === 'shield') {\n      return { kind: 'hotbar', index: player.selectedSlot, stack: held };\n    }\n    return null;\n  }\n\n  private setBlockingShieldStack(\n    player: PlayerSession,\n    slot: { kind: 'offhand' | 'hotbar'; index: number },\n    stack: ItemStack | null,\n  ) {\n    if (slot.kind === 'offhand') player.offhand = stack;\n    else player.inventory[slot.index] = stack;\n  }\n\n  private damageHeldMeleeItem(player: PlayerSession, amount: number) {\n    if (amount <= 0) return;\n    const held = player.inventory[player.selectedSlot];\n    if (!held) return;\n    player.inventory[player.selectedSlot] = damageDurableStack(held, amount, 'tool');\n    this.syncPlayerInventory(player);\n  }\n\n  private applyServerDamageToPlayer(\n    player: PlayerSession,\n    rawDamage: number,\n    kind: PlayerDamageKind,\n    source: THREE.Vector3,\n    isAxeHit = false,\n  ): number {\n    if (!Number.isFinite(rawDamage) || rawDamage <= 0 || player.health <= 0) return 0;\n\n    const shieldSlot = this.getBlockingShieldSlot(player);\n    if (shieldSlot) {\n      const shieldResult = resolveServerShieldBlock(\n        rawDamage,\n        kind,\n        {\n          isBlocking: player.isBlocking,\n          usingSeconds: player.shieldUseSeconds,\n          disabledSeconds: player.shieldDisabledSeconds,\n          x: player.x,\n          z: player.z,\n          yaw: player.yaw,\n        },\n        source.x,\n        source.z,\n        isAxeHit,\n      );\n      if (shieldResult.blocked) {\n        if (shieldResult.durabilityDamage > 0) {\n          this.setBlockingShieldStack(\n            player,\n            shieldSlot,\n            damageDurableStack(shieldSlot.stack, shieldResult.durabilityDamage, 'tool'),\n          );\n        }\n        if (shieldResult.disableSeconds > 0) {\n          player.shieldDisabledSeconds = Math.max(player.shieldDisabledSeconds, shieldResult.disableSeconds);\n          player.shieldUseSeconds = 0;\n        }\n        this.syncPlayerInventory(player);\n        return 0;\n      }\n    }\n\n    const hurt = resolveHurtDamage(player.hurtCooldown, rawDamage);\n    player.hurtCooldown = hurt.next;\n    if (!hurt.accepted || hurt.appliedDamage <= 0) return 0;\n\n    const mitigated = mitigateServerPlayerDamage(hurt.appliedDamage, kind, player.armor);\n    player.armor = damageServerArmorForHit(player.armor, hurt.appliedDamage, kind);\n    player.health = Math.max(0, player.health - mitigated);\n    player.healthAuthorityLockSeconds = Math.max(player.healthAuthorityLockSeconds, 1);\n    this.syncPlayerInventory(player);\n    this.syncPlayerState(player);\n    this.broadcastDimension(player.dimension, PacketType.S2C_SOUND, {\n      type: 'hurt', x: player.x, y: player.y, z: player.z\n    });\n    return mitigated;\n  }\n\n`;
  server = replaceOnce(server, '  // --- World interaction ---', helpers + '  // --- World interaction ---', 'server damage helpers');

  server = replaceOnce(
    server,
    `  private tick() {\n    const dt = 0.05; // 50ms\n\n    // Time cycle increment`,
    `  private tick() {\n    const dt = 0.05; // 50ms\n    this.gameTick += 1;\n    for (const player of this.players.values()) {\n      player.hurtCooldown = tickHurtCooldown(player.hurtCooldown, dt);\n      player.shieldDisabledSeconds = Math.max(0, player.shieldDisabledSeconds - dt);\n      player.healthAuthorityLockSeconds = Math.max(0, player.healthAuthorityLockSeconds - dt);\n      if (player.isBlocking && player.shieldDisabledSeconds <= 0 && this.getBlockingShieldSlot(player)) {\n        player.shieldUseSeconds += dt;\n      } else {\n        player.shieldUseSeconds = 0;\n      }\n    }\n\n    // Time cycle increment`,
    'server authority tick state',
  );

  server = replaceOnce(
    server,
    `              chaseTarget.health = Math.max(0, chaseTarget.health - (MOB_DEFS[mob.type]?.damage || 2));\n              this.broadcast(PacketType.S2C_SOUND, { type: 'hurt', x: chaseTarget.x, y: chaseTarget.y, z: chaseTarget.z });\n              this.sendTo(chaseTarget, PacketType.S2C_PLAYER_STATE, {\n                health: chaseTarget.health,\n                hunger: chaseTarget.hunger,\n                oxygen: chaseTarget.oxygen,\n                level: chaseTarget.xpLevel,\n                xpProgress: chaseTarget.xpCurrent / (7 + chaseTarget.xpLevel * 7)\n              });`,
    `              this.applyServerDamageToPlayer(\n                chaseTarget,\n                MOB_DEFS[mob.type]?.damage || 2,\n                'mob',\n                mob.position,\n                false,\n              );`,
    'mob melee server damage',
  );

  server = replaceRegexOnce(
    server,
    /            player\.health = Math\.max\(0, player\.health - dmg\);\n            this\.broadcast\(PacketType\.S2C_SOUND, \{ type: 'hurt', x: player\.x, y: player\.y, z: player\.z \}\);\n            this\.sendTo\(player, PacketType\.S2C_PLAYER_STATE, \{[\s\S]*?            \}\);/,
    `            this.applyServerDamageToPlayer(player, dmg, 'explosion', pos, false);`,
    'explosion player damage',
  );

  server = replaceOnce(
    server,
    `            player.health = Math.max(0, player.health - 3); // arrow damage\n            this.broadcast(PacketType.S2C_SOUND, { type: 'hurt', x: player.x, y: player.y, z: player.z });\n            this.sendTo(player, PacketType.S2C_PLAYER_STATE, {\n              health: player.health,\n              hunger: player.hunger,\n              oxygen: player.oxygen,\n              level: player.xpLevel,\n              xpProgress: player.xpCurrent / (7 + player.xpLevel * 7)\n            });`,
    `            this.applyServerDamageToPlayer(player, proj.damage, 'projectile', proj.position, false);`,
    'projectile player damage',
  );

  server = replaceOnce(
    server,
    `            mob.health -= 4;`,
    `            mob.health -= proj.damage;`,
    'projectile mob damage',
  );

  server = replaceOnce(
    server,
    `    for (let i = 0; i < 36; i++) {\n      const stack = player.inventory[i];\n      if (stack) {\n        this.spawnDroppedItem(stack.id, stack.count, player.x, player.y, player.z, player.dimension);\n        player.inventory[i] = null;\n      }\n    }\n    player.health = 20;`,
    `    for (let i = 0; i < 36; i++) {\n      const stack = player.inventory[i];\n      if (stack) {\n        this.spawnDroppedItem(stack.id, stack.count, player.x, player.y, player.z, player.dimension);\n        player.inventory[i] = null;\n      }\n    }\n    for (let i = 0; i < player.armor.length; i++) {\n      const stack = player.armor[i];\n      if (stack) {\n        this.spawnDroppedItem(stack.id, stack.count, player.x, player.y, player.z, player.dimension);\n        player.armor[i] = null;\n      }\n    }\n    if (player.offhand) {\n      this.spawnDroppedItem(player.offhand.id, player.offhand.count, player.x, player.y, player.z, player.dimension);\n      player.offhand = null;\n    }\n    player.health = 20;`,
    'server death equipment drops',
  );

  server = replaceOnce(
    server,
    `  private broadcast(type: PacketType, payload: any) {\n    const packetStr = JSON.stringify({ type, payload });\n    for (const player of this.players.values()) {\n      if (player.socket.readyState === 1) {\n        player.socket.send(packetStr);\n      }\n    }\n  }`,
    `  private broadcast(type: PacketType, payload: any) {\n    const packetStr = JSON.stringify({ type, payload });\n    for (const player of this.players.values()) {\n      if (player.socket.readyState === 1) {\n        player.socket.send(packetStr);\n      }\n    }\n  }\n\n  private broadcastDimension(dimension: number, type: PacketType, payload: any) {\n    const packetStr = JSON.stringify({ type, payload });\n    for (const player of this.players.values()) {\n      if (player.dimension === dimension && player.socket.readyState === 1) {\n        player.socket.send(packetStr);\n      }\n    }\n  }`,
    'dimension broadcast helper',
  );

  write(serverPath, server);

  const mobPath = 'src/systems/MobSystem.ts';
  let mobs = read(mobPath);
  const getMobInRay = `  /** Return the nearest mob intersected by the entity interaction ray without mutating it. */\n  getMobInRay(playerPos: THREE.Vector3, direction: THREE.Vector3, reach: number): Mob | null {\n    const ray = new THREE.Raycaster(playerPos, direction, 0, reach);\n    let closestMob: Mob | null = null;\n    let closestDist = reach;\n    for (const mob of this.mobs.values()) {\n      const hw = mob.width / 2;\n      const box = new THREE.Box3(\n        new THREE.Vector3(mob.position.x - hw, mob.position.y, mob.position.z - hw),\n        new THREE.Vector3(mob.position.x + hw, mob.position.y + mob.height, mob.position.z + hw),\n      );\n      const intersection = new THREE.Vector3();\n      if (ray.ray.intersectBox(box, intersection)) {\n        const dist = intersection.distanceTo(playerPos);\n        if (dist < closestDist) {\n          closestDist = dist;\n          closestMob = mob;\n        }\n      }\n    }\n    return closestMob;\n  }\n\n`;
  mobs = replaceOnce(mobs, '  /** Player attacks mob via raycast. Returns true if hit. */', getMobInRay + '  /** Player attacks mob via raycast. Returns true if hit. */', 'MobSystem non-mutating ray');
  write(mobPath, mobs);

  const clientPath = 'src/server/NetworkClient.ts';
  let client = read(clientPath);
  const rayMethod = `  getOtherPlayerInRay(origin: THREE.Vector3, direction: THREE.Vector3, reach: number): string | null {\n    const ray = new THREE.Ray(origin, direction.clone().normalize());\n    let closestId: string | null = null;\n    let closestDistance = reach;\n    for (const [id, player] of this.otherPlayers.entries()) {\n      const pos = player.mesh.position;\n      const box = new THREE.Box3(\n        new THREE.Vector3(pos.x - 0.3, pos.y, pos.z - 0.3),\n        new THREE.Vector3(pos.x + 0.3, pos.y + 1.8, pos.z + 0.3),\n      );\n      const hit = new THREE.Vector3();\n      if (ray.intersectBox(box, hit)) {\n        const distance = hit.distanceTo(origin);\n        if (distance <= closestDistance) {\n          closestDistance = distance;\n          closestId = id;\n        }\n      }\n    }\n    return closestId;\n  }\n\n`;
  client = replaceOnce(client, '  // --- Interpolation helper for other players ---', rayMethod + '  // --- Interpolation helper for other players ---', 'NetworkClient player ray');
  write(clientPath, client);

  const gamePath = 'src/engine/Game.ts';
  let game = read(gamePath);
  game = replaceOnce(
    game,
    `        this.network.send(PacketType.C2S_PLAYER_STATE, {\n          health: this.player.health,\n          hunger: this.player.hunger,\n          oxygen: this.player.oxygen,\n        });`,
    `        this.network.send(PacketType.C2S_PLAYER_STATE, {\n          health: this.player.health,\n          hunger: this.player.hunger,\n          oxygen: this.player.oxygen,\n          blocking: this.isShieldBlocking,\n        });`,
    'Game blocking state upload',
  );

  game = replaceOnce(
    game,
    `        // First: try to attack mob\n        const dir = this.player.forward;\n      const mobHit = this.mobs.playerAttackMob(\n        this.player.eyePosition,\n        dir,\n        meleeAttackDamage,\n        4.5,`,
    `        // First: try server-authoritative player/mob attack in multiplayer.\n        const dir = this.player.forward;\n        const entityReach = this.gameMode === 'creative' ? 5 : 3;\n        if (isNetworkConnected) {\n          const playerId = this.network.getOtherPlayerInRay(this.player.eyePosition, dir, entityReach);\n          if (playerId) {\n            this.network.send(PacketType.C2S_INTERACT_ENTITY, { entityId: playerId, type: 'attack' });\n            this.swordSwingTimer = 0.4;\n            this.startAttackCooldown(attackCooldownDuration);\n            return;\n          }\n          const networkMob = this.mobs.getMobInRay(this.player.eyePosition, dir, entityReach);\n          if (networkMob) {\n            this.network.send(PacketType.C2S_INTERACT_ENTITY, { entityId: networkMob.id, type: 'attack' });\n            this.swordSwingTimer = 0.4;\n            this.startAttackCooldown(attackCooldownDuration);\n            return;\n          }\n        }\n\n      const mobHit = this.mobs.playerAttackMob(\n        this.player.eyePosition,\n        dir,\n        meleeAttackDamage,\n        entityReach,`,
    'Game multiplayer entity attack intent',
  );
  write(gamePath, game);
}

function patchWorld() {
  const serverPath = 'src/server/GameServer.ts';
  let server = read(serverPath);

  server = replaceOnce(
    server,
    "import { applyContainerClick, containerKey, createContainerSlots, validateContainerClick, validateContainerSlots } from './ContainerRules';",
    `import { applyContainerClick, containerKey, createContainerSlots, validateContainerClick, validateContainerSlots } from './ContainerRules';\nimport {\n  canPlaceHeldBlock,\n  consumeHeldStack,\n  isBlockActionInReach,\n  isValidBlockCoordinate,\n  isValidHotbarSlot,\n  isValidInventoryStack,\n  isValidWorldY,\n} from './ServerWorldActionRules';`,
    'world action imports',
  );

  server = replaceRegexOnce(
    server,
    /      case PacketType\.C2S_BLOCK_BREAK: \{[\s\S]*?        break;\n      \}\n\n      case PacketType\.C2S_BLOCK_PLACE:/,
    `      case PacketType.C2S_BLOCK_BREAK: {\n        const { x, y, z } = packet.payload;\n        if (!isValidBlockCoordinate(x) || !isValidWorldY(y, WORLD_HEIGHT) || !isValidBlockCoordinate(z)) break;\n        if (!isBlockActionInReach(session, x, y, z, 'survival')) break;\n        const blockId = this.getBlock(x, y, z, session.dimension);\n        if (blockId === 0) break;\n\n        this.setBlock(x, y, z, 0, session.dimension);\n        const tool = session.inventory[session.selectedSlot];\n        if (tool && ItemRegistry.isTool(tool.id)) {\n          session.inventory[session.selectedSlot] = damageDurableStack(tool, 1, 'tool');\n          this.syncPlayerInventory(session);\n        }\n        this.broadcastDimension(session.dimension, PacketType.S2C_BLOCK_UPDATE, {\n          x, y, z, blockId: 0, dimension: session.dimension\n        });\n        this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, { type: 'break', x, y, z });\n        break;\n      }\n\n      case PacketType.C2S_BLOCK_PLACE:`,
    'C2S_BLOCK_BREAK validation',
  );

  server = replaceRegexOnce(
    server,
    /      case PacketType\.C2S_BLOCK_PLACE: \{[\s\S]*?        break;\n      \}\n\n      case PacketType\.C2S_CHAT:/,
    `      case PacketType.C2S_BLOCK_PLACE: {\n        const { x, y, z, blockId, facing } = packet.payload;\n        if (!isValidBlockCoordinate(x) || !isValidWorldY(y, WORLD_HEIGHT) || !isValidBlockCoordinate(z)) break;\n        if (!Number.isInteger(blockId) || blockId <= 0) break;\n        if (!isBlockActionInReach(session, x, y, z, 'survival')) break;\n        if (this.getBlock(x, y, z, session.dimension) !== 0) break;\n\n        const held = session.inventory[session.selectedSlot];\n        if (!canPlaceHeldBlock(held, blockId)) break;\n        const validFacing = facing === 'north' || facing === 'south' || facing === 'east' || facing === 'west' || facing === 'up' || facing === 'down';\n        const meta = validFacing ? { facing } : null;\n        this.setBlock(x, y, z, blockId, session.dimension, meta);\n        session.inventory[session.selectedSlot] = consumeHeldStack(held!);\n        this.syncPlayerInventory(session);\n        this.broadcastDimension(session.dimension, PacketType.S2C_BLOCK_UPDATE, {\n          x, y, z, blockId, metadata: meta, dimension: session.dimension\n        });\n        this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, { type: 'place', x, y, z });\n        break;\n      }\n\n      case PacketType.C2S_CHAT:`,
    'C2S_BLOCK_PLACE validation',
  );

  server = replaceOnce(
    server,
    `      case PacketType.C2S_HELD_ITEM_CHANGE: {\n        const { slot } = packet.payload;\n        session.selectedSlot = slot;\n        break;\n      }`,
    `      case PacketType.C2S_HELD_ITEM_CHANGE: {\n        const { slot } = packet.payload;\n        if (isValidHotbarSlot(slot)) session.selectedSlot = slot;\n        break;\n      }`,
    'hotbar slot validation',
  );

  server = replaceRegexOnce(
    server,
    /      case PacketType\.C2S_INVENTORY_CLICK: \{[\s\S]*?        break;\n      \}\n\n      case PacketType\.C2S_INTERACT_BLOCK:/,
    `      case PacketType.C2S_INVENTORY_CLICK: {\n        const { slotIndex, heldItem } = packet.payload;\n        if (!Number.isInteger(slotIndex) || !isValidInventoryStack(heldItem)) break;\n        if (slotIndex >= 0 && slotIndex < 36) {\n          session.inventory[slotIndex] = heldItem ? { ...heldItem } : null;\n        } else if (slotIndex >= 100 && slotIndex < 104) {\n          if (heldItem && ItemRegistry.get(heldItem.id)?.category !== 'armor') break;\n          session.armor[slotIndex - 100] = heldItem ? { ...heldItem } : null;\n        } else if (slotIndex === 200) {\n          session.offhand = heldItem ? { ...heldItem } : null;\n        } else {\n          break;\n        }\n        this.syncPlayerInventory(session);\n        break;\n      }\n\n      case PacketType.C2S_INTERACT_BLOCK:`,
    'inventory click validation',
  );

  server = replaceOnce(
    server,
    `      case PacketType.C2S_INTERACT_BLOCK: {\n        const { x, y, z } = packet.payload;\n        const blockId = this.getBlock(x, y, z, session.dimension);`,
    `      case PacketType.C2S_INTERACT_BLOCK: {\n        const { x, y, z } = packet.payload;\n        if (!isValidBlockCoordinate(x) || !isValidWorldY(y, WORLD_HEIGHT) || !isValidBlockCoordinate(z)) break;\n        if (!isBlockActionInReach(session, x, y, z, 'survival')) break;\n        const blockId = this.getBlock(x, y, z, session.dimension);`,
    'interact block reach',
  );

  server = replaceOnce(
    server,
    `      case PacketType.C2S_CONTAINER_OPEN: {\n        const { x, y, z } = packet.payload;\n        const blockId = this.getBlock(x, y, z, session.dimension);`,
    `      case PacketType.C2S_CONTAINER_OPEN: {\n        const { x, y, z } = packet.payload;\n        if (!isValidBlockCoordinate(x) || !isValidWorldY(y, WORLD_HEIGHT) || !isValidBlockCoordinate(z)) break;\n        if (!isBlockActionInReach(session, x, y, z, 'survival')) break;\n        const blockId = this.getBlock(x, y, z, session.dimension);`,
    'container reach',
  );

  server = replaceOnce(
    server,
    `      case PacketType.C2S_ITEM_CONSUME: {\n        const { slot, itemId } = packet.payload;\n        const stack = session.inventory[slot];`,
    `      case PacketType.C2S_ITEM_CONSUME: {\n        const { slot, itemId } = packet.payload;\n        if (!Number.isInteger(slot) || slot < 0 || slot >= session.inventory.length) break;\n        const stack = session.inventory[slot];`,
    'consume slot validation',
  );

  server = replaceOnce(
    server,
    `      case PacketType.C2S_PLAYER_MOVE: {\n        const { x, y, z, yaw, pitch, flying } = packet.payload;\n        session.x = x;`,
    `      case PacketType.C2S_PLAYER_MOVE: {\n        const { x, y, z, yaw, pitch, flying } = packet.payload;\n        if (![x, y, z, yaw, pitch].every((value) => typeof value === 'number' && Number.isFinite(value))) break;\n        if (y < -64 || y > WORLD_HEIGHT + 64) break;\n        session.x = x;`,
    'finite player move',
  );

  server = replaceOnce(
    server,
    `      case PacketType.C2S_CHUNK_REQUEST: {\n        const { cx, cz } = packet.payload;\n        const chunk = this.getOrGenerateChunk(cx, cz, session.dimension);`,
    `      case PacketType.C2S_CHUNK_REQUEST: {\n        const { cx, cz } = packet.payload;\n        if (!Number.isInteger(cx) || !Number.isInteger(cz)) break;\n        const playerCx = Math.floor(session.x / CHUNK_SIZE);\n        const playerCz = Math.floor(session.z / CHUNK_SIZE);\n        if (Math.abs(cx - playerCx) > RENDER_DISTANCE + 2 || Math.abs(cz - playerCz) > RENDER_DISTANCE + 2) break;\n        const chunk = this.getOrGenerateChunk(cx, cz, session.dimension);`,
    'chunk request bounds',
  );

  server = replaceRegexOnce(
    server,
    /      case 'time': \{[\s\S]*?        break;\n      \}\n\n      case 'weather':/,
    `      case 'time': {\n        if (args[0] === 'set' && args[1]) {\n          const presets: Record<string, number> = { day: 1000, noon: 6000, night: 13000, midnight: 18000 };\n          const raw = presets[args[1]] ?? Number(args[1]);\n          if (Number.isFinite(raw)) {\n            const ticks = ((Math.floor(raw) % 24000) + 24000) % 24000;\n            this.gameTime = ticks / 24000;\n            this.broadcast(PacketType.S2C_TIME, { gameTime: this.gameTime });\n            this.sendSystemMessage(\`Set time to \${args[1]}\`);\n          }\n        }\n        break;\n      }\n\n      case 'weather':`,
    'server time command parity',
  );

  write(serverPath, server);
}

if (phase === 'combat') patchCombat();
else patchWorld();

console.log(`parity runtime patch complete: ${phase}`);
