import { readFileSync, writeFileSync } from 'node:fs';

const phase = process.argv[2];
if (phase !== 'server' && phase !== 'client') throw new Error('usage: node scripts/parity-111-130-runtime.mjs <server|client>');

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content, 'utf8'); }
function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`missing patch target: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`ambiguous patch target: ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}
function replaceRegexOnce(source, pattern, to, label) {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) throw new Error(`expected one ${label} match, got ${matches.length}`);
  return source.replace(pattern, to);
}

function patchServer() {
  const path = 'src/server/GameServer.ts';
  let s = read(path);

  s = replaceOnce(s,
`import {
  getServerMeleeDamage,
  getServerMeleeProfile,
  isEntityAttackInReach,
  parseEntityAttackIntent,
} from './ServerCombatRules';`,
`import {
  applyKnockbackResistance,
  getAttackStrength,
  getNetheriteKnockbackResistance,
  getServerKnockbackPlan,
  getServerMeleeDamage,
  getServerMeleeProfile,
  isEntityAttackInReach,
  isServerCriticalHit,
  parseEntityAttackIntent,
} from './ServerCombatRules';`, 'combat imports');

  s = replaceOnce(s,
`import { applyContainerClick, containerKey, createContainerSlots, validateContainerClick, validateContainerSlots } from './ContainerRules';`,
`import {
  applyServerContainerClick,
  containerKey,
  createContainerSlots,
  parseContainerClickIntent,
  returnContainerCursorToInventory,
} from './ContainerRules';
import {
  isDescendingAirborne,
  isMoveTooFast,
  isSurvivalFlightSpoof,
  parseServerMoveIntent,
} from './ServerMovementRules';
import { getDeathXpDrop, resetXpAfterDeath, shouldDropStackOnDeath } from './ServerDeathRules';
import { canExecuteServerCommand, clampGiveCount, isValidWeatherArgument } from './ServerCommandRules';`, 'container imports');

  s = replaceOnce(s,
`  flying: boolean;
  dimension: number;`,
`  flying: boolean;
  onGround: boolean;
  sprinting: boolean;
  descending: boolean;
  gameMode: 'survival' | 'creative';
  isOperator: boolean;
  dimension: number;`, 'session movement fields');

  s = replaceOnce(s,
`  healthAuthorityLockSeconds: number;
  /** P5.2 — guards one-time death handling. */`,
`  healthAuthorityLockSeconds: number;
  openContainer?: { x: number; y: number; z: number; key: string; cursor: ItemStack | null };
  /** P5.2 — guards one-time death handling. */`, 'session container state');

  s = replaceOnce(s,
`      flying: false,
      dimension: 0, // Overworld`,
`      flying: false,
      onGround: false,
      sprinting: false,
      descending: false,
      gameMode: 'survival',
      isOperator: isLocalHost,
      dimension: 0, // Overworld`, 'session defaults');

  s = replaceOnce(s,
`    switch (packet.type) {
      case PacketType.C2S_PLAYER_MOVE: {
        const { x, y, z, yaw, pitch, flying } = packet.payload;
        if (![x, y, z, yaw, pitch].every((value) => typeof value === 'number' && Number.isFinite(value))) break;
        if (y < -64 || y > WORLD_HEIGHT + 64) break;
        session.x = x;
        session.y = y;
        session.z = z;
        session.yaw = yaw;
        session.pitch = pitch;
        session.flying = flying;

        // Broadcast move packet to other players
        this.broadcastExcept(playerId, PacketType.S2C_PLAYER_MOVE, {
          playerId,
          x,
          y,
          z,
          yaw,
          pitch,
          flying
        });
        break;
      }`,
`    switch (packet.type) {
      case PacketType.C2S_JOIN: {
        const requestedMode = packet.payload?.mode === 'creative' ? 'creative' : 'survival';
        session.gameMode = session.isOperator ? requestedMode : 'survival';
        session.flying = false;
        this.sendTo(session, PacketType.S2C_JOIN_ACK, {
          playerId: session.id,
          seed: this.seed,
          x: session.x,
          y: session.y,
          z: session.z,
          gameMode: session.gameMode,
        });
        break;
      }

      case PacketType.C2S_PLAYER_MOVE: {
        const intent = parseServerMoveIntent(packet.payload);
        const invalidY = !intent || intent.y < -64 || intent.y > WORLD_HEIGHT + 64;
        const flightSpoof = intent ? isSurvivalFlightSpoof(intent, session.gameMode === 'creative') : true;
        const tooFast = intent ? isMoveTooFast(session, intent) : true;
        if (!intent || invalidY || flightSpoof || tooFast) {
          this.sendTo(session, PacketType.S2C_POSITION_CORRECTION, {
            x: session.x, y: session.y, z: session.z,
            yaw: session.yaw, pitch: session.pitch,
          });
          break;
        }

        session.descending = isDescendingAirborne(
          { x: session.x, y: session.y, z: session.z, onGround: session.onGround, sprinting: session.sprinting },
          intent,
        );
        session.x = intent.x;
        session.y = intent.y;
        session.z = intent.z;
        session.yaw = intent.yaw;
        session.pitch = intent.pitch;
        session.onGround = intent.onGround;
        session.sprinting = intent.sprinting && session.hunger > 6 && !session.flying;
        session.flying = session.gameMode === 'creative' && intent.flying;

        this.broadcastExcept(playerId, PacketType.S2C_PLAYER_MOVE, {
          playerId,
          x: session.x,
          y: session.y,
          z: session.z,
          yaw: session.yaw,
          pitch: session.pitch,
          flying: session.flying,
          onGround: session.onGround,
          sprinting: session.sprinting,
        });
        break;
      }`, 'movement authority handler');

  s = replaceOnce(s,
`      case PacketType.C2S_CHAT: {
        const { text } = packet.payload;
        if (text.startsWith('/')) {
          this.executeCommand(session, text);
        } else {
          this.broadcast(PacketType.S2C_CHAT, {
            sender: session.username,
            text
          });
        }
        break;
      }`,
`      case PacketType.C2S_CHAT: {
        const text = typeof packet.payload?.text === 'string' ? packet.payload.text.slice(0, 256) : '';
        if (!text) break;
        if (text.startsWith('/')) {
          this.executeCommand(session, text);
        } else {
          this.broadcastDimension(session.dimension, PacketType.S2C_CHAT, {
            sender: session.username,
            text
          });
        }
        break;
      }`, 'chat validation and dimension scoping');

  s = replaceRegexOnce(s,
/      case PacketType\.C2S_INTERACT_ENTITY: \{[\s\S]*?        break;\n      \}\n\n      \/\/ P5\.1: server-authoritative item actions/,
`      case PacketType.C2S_INTERACT_ENTITY: {
        const intent = parseEntityAttackIntent(packet.payload);
        if (!intent) break;

        const held = session.inventory[session.selectedSlot];
        const profile = getServerMeleeProfile(held);
        const attackStrength = getAttackStrength(session.lastAttackTick, this.gameTick, profile.cooldownTicks);
        const feetBlock = this.getBlock(Math.floor(session.x), Math.floor(session.y), Math.floor(session.z), session.dimension);
        const critical = isServerCriticalHit(attackStrength, {
          descending: session.descending,
          onGround: session.onGround,
          sprinting: session.sprinting,
          flying: session.flying,
          inWater: BlockRegistry.isFluid(feetBlock),
        });
        const damage = getServerMeleeDamage(held, session.lastAttackTick, this.gameTick, critical);
        const knockback = getServerKnockbackPlan(held, attackStrength, session.sprinting);

        if (typeof intent.entityId === 'number') {
          const mob = this.mobs.get(intent.entityId);
          if (!mob || mob.health <= 0 || mob.dimension !== session.dimension) break;
          if (!isEntityAttackInReach(session, mob.position, session.gameMode)) break;

          session.lastAttackTick = this.gameTick;
          mob.health -= damage;
          mob.hurtTimer = 0.5;
          this.applyMeleeKnockbackToMob(session, mob, knockback.strength);
          if (knockback.sprintKnockback) session.sprinting = false;
          this.damageHeldMeleeItem(session, profile.durabilityCost);
          this.broadcastDimension(session.dimension, PacketType.S2C_MOB_STATE, {
            id: mob.id,
            health: mob.health,
            hurtTimer: mob.hurtTimer
          });
          this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
            type: critical ? 'critical_hit' : 'hit', x: mob.position.x, y: mob.position.y, z: mob.position.z
          });
          if (mob.health <= 0) this.handleMobDeath(mob);
          break;
        }

        const target = this.players.get(intent.entityId);
        if (!target || target.id === session.id || target.dimension !== session.dimension) break;
        if (!isEntityAttackInReach(session, target, session.gameMode)) break;

        session.lastAttackTick = this.gameTick;
        this.damageHeldMeleeItem(session, profile.durabilityCost);
        const applied = this.applyServerDamageToPlayer(
          target,
          damage,
          'mob',
          new THREE.Vector3(session.x, session.y + 1.62, session.z),
          profile.isAxe,
        );
        if (applied > 0) {
          const resistance = getNetheriteKnockbackResistance(target.armor);
          this.applyMeleeKnockbackToPlayer(session, target, applyKnockbackResistance(knockback.strength, resistance));
        }
        if (knockback.sprintKnockback) session.sprinting = false;
        break;
      }

      // P5.1: server-authoritative item actions`, 'combat runtime handler');

  s = replaceRegexOnce(s,
/      \/\/ P5\.3: container authority — the server owns chest contents\.[\s\S]*?      case PacketType\.C2S_CONTAINER_UPDATE: \{[\s\S]*?        break;\n      \}/,
`      // P5.3: authoritative container transaction session.
      case PacketType.C2S_CONTAINER_OPEN: {
        const { x, y, z } = packet.payload;
        if (!isValidBlockCoordinate(x) || !isValidWorldY(y, WORLD_HEIGHT) || !isValidBlockCoordinate(z)) break;
        if (!isBlockActionInReach(session, x, y, z, session.gameMode)) break;
        const blockId = this.getBlock(x, y, z, session.dimension);
        const name = BlockRegistry.get(blockId)?.name ?? '';
        const kind = name.includes('hopper') ? 'hopper' : (name.includes('chest') || name.includes('barrel') ? 'chest' : null);
        if (!kind) break;
        this.closeServerContainer(session);
        const key = this.dimensionContainerKey(session.dimension, x, y, z);
        if (!this.containerData.has(key)) this.containerData.set(key, createContainerSlots(kind));
        session.openContainer = { x, y, z, key, cursor: null };
        this.sendOpenContainerState(session);
        break;
      }

      case PacketType.C2S_CONTAINER_CLICK: {
        const intent = parseContainerClickIntent(packet.payload);
        const open = session.openContainer;
        if (!intent || !open) break;
        if (!isBlockActionInReach(session, open.x, open.y, open.z, session.gameMode)) {
          this.closeServerContainer(session);
          break;
        }
        const slots = this.containerData.get(open.key);
        if (!slots) break;
        const next = applyServerContainerClick({
          containerSlots: slots,
          playerSlots: session.inventory,
          cursor: open.cursor,
        }, intent);
        if (!next) {
          this.sendOpenContainerState(session);
          break;
        }
        this.containerData.set(open.key, next.containerSlots);
        session.inventory = next.playerSlots;
        open.cursor = next.cursor;
        this.syncPlayerInventory(session);
        this.sendOpenContainerState(session);
        break;
      }

      case PacketType.C2S_CONTAINER_CLOSE: {
        this.closeServerContainer(session);
        break;
      }

      case PacketType.C2S_CONTAINER_UPDATE: {
        // Legacy whole-container snapshots are never authoritative. A stale or
        // malicious client receives the canonical server state instead.
        this.sendOpenContainerState(session);
        break;
      }`, 'container runtime handler');

  s = replaceOnce(s,
`  private executeCommand(session: PlayerSession, cmdText: string) {
    const parts = cmdText.substring(1).split(' ');`,
`  private executeCommand(session: PlayerSession, cmdText: string) {
    if (!canExecuteServerCommand(cmdText, session.isOperator)) {
      this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: 'You do not have permission to use that command.' });
      return;
    }
    const parts = cmdText.substring(1).trim().split(/\\s+/);`, 'command authorization');

  s = replaceOnce(s,
`          const itemId = parseInt(args[0]);
          const count = args[1] ? parseInt(args[1]) : 64;
          
          // Find empty slot or matching slot
          let added = false;`,
`          const itemId = parseInt(args[0]);
          const def = ItemRegistry.get(itemId);
          const count = def ? clampGiveCount(args[1] ?? def.maxStackSize, def.maxStackSize) : null;
          if (!def || count === null) break;

          // Find empty slot or matching slot
          let added = false;`, 'give validation');

  s = replaceOnce(s,
`            } else if (slot.id === itemId && slot.count + count <= 64) {`,
`            } else if (slot.id === itemId && slot.count + count <= def.maxStackSize) {`, 'give max stack');

  s = replaceOnce(s,
`      case 'weather': {
        if (args[0]) {
          const w = args[0] as 'clear' | 'rain' | 'thunder';
          this.weatherType = w;`,
`      case 'weather': {
        if (isValidWeatherArgument(args[0])) {
          const w = args[0];
          this.weatherType = w;`, 'weather validation');

  const helpers = `
  private dimensionContainerKey(dimension: number, x: number, y: number, z: number): string {
    return \`${'${dimension}'}:${'${containerKey(x, y, z)}'}\`;
  }

  private sendOpenContainerState(player: PlayerSession) {
    const open = player.openContainer;
    if (!open) return;
    this.sendTo(player, PacketType.S2C_CONTAINER_DATA, {
      x: open.x,
      y: open.y,
      z: open.z,
      slots: this.containerData.get(open.key) ?? [],
      cursor: open.cursor,
    });
  }

  private closeServerContainer(player: PlayerSession) {
    const open = player.openContainer;
    if (!open) return;
    const slots = this.containerData.get(open.key) ?? [];
    const next = returnContainerCursorToInventory({
      containerSlots: slots,
      playerSlots: player.inventory,
      cursor: open.cursor,
    });
    this.containerData.set(open.key, next.containerSlots);
    player.inventory = next.playerSlots;
    if (next.cursor) {
      this.spawnDroppedItem(next.cursor.id, next.cursor.count, player.x, player.y + 0.5, player.z, player.dimension);
    }
    player.openContainer = undefined;
    this.syncPlayerInventory(player);
  }

  private applyMeleeKnockbackToMob(attacker: PlayerSession, target: ServerMob, strength: number) {
    if (strength <= 0) return;
    const dx = target.position.x - attacker.x;
    const dz = target.position.z - attacker.z;
    const length = Math.hypot(dx, dz);
    if (length <= 1e-9) return;
    const scale = 0.5 * strength / length;
    target.velocity.x = target.velocity.x * 0.5 + dx * scale;
    target.velocity.z = target.velocity.z * 0.5 + dz * scale;
    target.velocity.y = Math.min(0.4, target.velocity.y * 0.5 + 0.4);
  }

  private applyMeleeKnockbackToPlayer(attacker: PlayerSession, target: PlayerSession, strength: number) {
    if (strength <= 0) return;
    const dx = target.x - attacker.x;
    const dz = target.z - attacker.z;
    const length = Math.hypot(dx, dz);
    if (length <= 1e-9) return;
    this.sendTo(target, PacketType.S2C_PLAYER_VELOCITY, {
      x: dx / length * 0.5 * strength,
      y: 0.4,
      z: dz / length * 0.5 * strength,
    });
  }

`;
  s = replaceOnce(s, '  private syncPlayerInventory(player: PlayerSession) {', helpers + '  private syncPlayerInventory(player: PlayerSession) {', 'container/knockback helpers');

  s = replaceOnce(s,
`  removePlayer(id: string) {
    const session = this.players.get(id);
    if (session) {
      console.log(\`Player \${session.username} disconnected.\`);
      this.players.delete(id);`,
`  removePlayer(id: string) {
    const session = this.players.get(id);
    if (session) {
      console.log(\`Player \${session.username} disconnected.\`);
      this.closeServerContainer(session);
      this.players.delete(id);`, 'container reconcile on disconnect');

  s = replaceOnce(s,
`    const deathDimension = player.dimension;
    // Drop inventory in the world.`,
`    const deathDimension = player.dimension;
    this.closeServerContainer(player);
    const deathXp = getDeathXpDrop(player.xpLevel);
    // Drop inventory in the world.`, 'death container/xp capture');

  s = replaceOnce(s,
`      if (stack) {
        this.spawnDroppedItem(stack.id, stack.count, player.x, player.y, player.z, player.dimension);
        player.inventory[i] = null;
      }`,
`      if (stack) {
        if (shouldDropStackOnDeath(stack)) {
          this.spawnDroppedItem(stack.id, stack.count, player.x, player.y, player.z, player.dimension);
        }
        player.inventory[i] = null;
      }`, 'death inventory vanishing');

  // Apply the same Vanishing rule to armor and offhand using targeted replacements.
  s = replaceOnce(s,
`      if (stack) {
        this.spawnDroppedItem(stack.id, stack.count, player.x, player.y, player.z, player.dimension);
        player.armor[i] = null;
      }`,
`      if (stack) {
        if (shouldDropStackOnDeath(stack)) {
          this.spawnDroppedItem(stack.id, stack.count, player.x, player.y, player.z, player.dimension);
        }
        player.armor[i] = null;
      }`, 'death armor vanishing');

  s = replaceOnce(s,
`    if (player.offhand) {
      this.spawnDroppedItem(player.offhand.id, player.offhand.count, player.x, player.y, player.z, player.dimension);
      player.offhand = null;
    }`,
`    if (player.offhand) {
      if (shouldDropStackOnDeath(player.offhand)) {
        this.spawnDroppedItem(player.offhand.id, player.offhand.count, player.x, player.y, player.z, player.dimension);
      }
      player.offhand = null;
    }`, 'death offhand vanishing');

  s = replaceOnce(s,
`    player.health = 20;
    player.hunger = 20;
    player.oxygen = 15;`,
`    player.health = 20;
    player.hunger = 20;
    player.oxygen = 15;
    const resetXp = resetXpAfterDeath({ level: player.xpLevel, current: player.xpCurrent, progress: player.xpProgress });
    player.xpLevel = resetXp.level;
    player.xpCurrent = resetXp.current;
    player.xpProgress = resetXp.progress;
    if (deathXp > 0) {
      this.broadcastDimension(deathDimension, PacketType.S2C_SOUND, {
        type: 'xp_drop', amount: deathXp, x: deathX, y: deathY, z: deathZ,
      });
    }`, 'death xp reset');

  s = replaceOnce(s,
`    player.lastAttackTick = null;
    player.dead = false;`,
`    player.lastAttackTick = null;
    player.onGround = false;
    player.sprinting = false;
    player.descending = false;
    player.flying = false;
    player.dead = false;`, 'death movement reset');

  write(path, s);
}

function patchClient() {
  let n = read('src/server/NetworkClient.ts');
  n = replaceOnce(n,
`      case PacketType.S2C_PLAYER_STATE: {`,
`      case PacketType.S2C_POSITION_CORRECTION: {
        const { x, y, z, yaw, pitch } = packet.payload;
        this.game.player.position.set(x, y, z);
        this.game.player.velocity.set(0, 0, 0);
        if (Number.isFinite(yaw)) this.game.player.yaw = yaw;
        if (Number.isFinite(pitch)) this.game.player.pitch = pitch;
        break;
      }

      case PacketType.S2C_PLAYER_VELOCITY: {
        const { x, y, z } = packet.payload;
        if ([x, y, z].every(Number.isFinite)) {
          this.game.player.velocity.add(new THREE.Vector3(x, y, z));
        }
        break;
      }

      case PacketType.S2C_PLAYER_STATE: {`, 'movement correction handlers');

  n = replaceOnce(n,
`      case PacketType.S2C_CONTAINER_DATA: {
        const { x, y, z, slots } = packet.payload;
        this.game.applyServerContainerData(x, y, z, slots);
        break;
      }`,
`      case PacketType.S2C_CONTAINER_DATA: {
        const { x, y, z, slots, cursor } = packet.payload;
        this.game.applyServerContainerData(x, y, z, slots, cursor ?? null);
        break;
      }`, 'container cursor sync');
  write('src/server/NetworkClient.ts', n);

  let g = read('src/engine/Game.ts');
  g = replaceOnce(g,
`        pitch: this.player.pitch,
        flying: this.player.flying
      });`,
`        pitch: this.player.pitch,
        flying: this.player.flying,
        onGround: this.player.onGround,
        sprinting: this.input.isKeyDown('control') && this.input.isKeyDown('w') && this.player.hunger > 6 && !this.player.flying,
      });`, 'client movement flags');

  g = replaceOnce(g,
`  applyServerContainerData(x: number, y: number, z: number, slots: (ItemStack | null)[]) {`,
`  applyServerContainerData(x: number, y: number, z: number, slots: (ItemStack | null)[], cursor: ItemStack | null = null) {
    this.serverContainerCursor = cursor;`, 'server container cursor state');

  g = replaceOnce(g,
`  private openChestPos: THREE.Vector3 | null = null;`,
`  private openChestPos: THREE.Vector3 | null = null;
  private serverContainerCursor: ItemStack | null = null;`, 'game container cursor field');

  g = replaceOnce(g,
`      chestInventory: this.getOpenChestInventory(),`,
`      chestInventory: this.getOpenChestInventory(),
      serverContainerCursor: this.serverContainerCursor,`, 'game state cursor');

  g = replaceOnce(g,
`  saveOpenChestInventory() {
    if (!this.openChestPos) return;
    const metadata = this.chunks.getBlockMetadata(
      Math.floor(this.openChestPos.x),
      Math.floor(this.openChestPos.y),
      Math.floor(this.openChestPos.z),
    );
    if (metadata?.inventory && this.network.isConnected) {
      this.network.send(PacketType.C2S_CONTAINER_UPDATE, {
        x: Math.floor(this.openChestPos.x),
        y: Math.floor(this.openChestPos.y),
        z: Math.floor(this.openChestPos.z),
        slots: metadata.inventory,
      });
    }
  }`,
`  saveOpenChestInventory() {
    if (!this.openChestPos || !this.network.isConnected) return;
    this.network.send(PacketType.C2S_CONTAINER_CLOSE, {});
    this.serverContainerCursor = null;
  }

  serverContainerClick(area: 'container' | 'player', slotIndex: number) {
    if (!this.network.isConnected || !this.openChestPos) return false;
    this.network.send(PacketType.C2S_CONTAINER_CLICK, { area, slotIndex });
    return true;
  }`, 'client container intents');

  g = replaceOnce(g,
`export interface GameState {`,
`export interface GameState {`, 'game state anchor');
  // Add cursor next to chestInventory in the interface only once.
  g = replaceOnce(g,
`  chestInventory: (ItemStack | null)[] | null;`,
`  chestInventory: (ItemStack | null)[] | null;
  serverContainerCursor: ItemStack | null;`, 'game state cursor interface');

  // Network deaths are immediately respawned by the authoritative server; do
  // not enter the local singleplayer death screen and independently mutate XP.
  g = replaceOnce(g,
`    if (this.player.health <= 0) {
      this.openUI = 'death';
      const keepInv = this.gamerules.getRule('keepInventory');`,
`    if (this.player.health <= 0 && !isNetworkConnected) {
      this.openUI = 'death';
      const keepInv = this.gamerules.getRule('keepInventory');`, 'suppress local multiplayer death authority');
  write('src/engine/Game.ts', g);
}

if (phase === 'server') patchServer(); else patchClient();
console.log(`parity 111-130 runtime patch complete: ${phase}`);
