import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/server/GameServer.ts';
let source = readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`missing patch target: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`ambiguous patch target: ${label}`);
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

replaceOnce(
`      case PacketType.C2S_INVENTORY_CLICK: {
        const { slotIndex, heldItem } = packet.payload;
        if (!Number.isInteger(slotIndex) || !isValidInventoryStack(heldItem)) break;
        if (slotIndex >= 0 && slotIndex < 36) {
          session.inventory[slotIndex] = heldItem ? { ...heldItem } : null;
        } else if (slotIndex >= 100 && slotIndex < 104) {
          if (heldItem && ItemRegistry.get(heldItem.id)?.category !== 'armor') break;
          session.armor[slotIndex - 100] = heldItem ? { ...heldItem } : null;
        } else if (slotIndex === 200) {
          session.offhand = heldItem ? { ...heldItem } : null;
        } else {
          break;
        }
        this.syncPlayerInventory(session);
        break;
      }`,
`      case PacketType.C2S_INVENTORY_CLICK: {
        // A client-provided slot snapshot cannot prove where an item came from.
        // Reject direct overwrites until an explicit server-validated transaction
        // protocol is used; return the canonical server inventory instead.
        this.syncPlayerInventory(session);
        break;
      }`,
'direct inventory overwrite rejection',
);

replaceOnce(
`  /** P5.2 — drop the inventory to the world, respawn the player, sync. */
  private handlePlayerDeath(player: PlayerSession) {
    player.dead = true;
    // Drop inventory in the world.`,
`  /** P5.2 — drop equipment, respawn in the Overworld, and sync canonical state. */
  private handlePlayerDeath(player: PlayerSession) {
    player.dead = true;
    const deathX = player.x;
    const deathY = player.y;
    const deathZ = player.z;
    const deathDimension = player.dimension;
    // Drop inventory in the world.`,
'death context capture',
);

replaceOnce(
`    player.health = 20;
    player.hunger = 20;
    player.oxygen = 15;
    this.sendTo(player, PacketType.S2C_INVENTORY_SYNC, {
      slots: player.inventory,
      armor: player.armor,
      offhand: player.offhand,
    });
    this.sendTo(player, PacketType.S2C_PLAYER_STATE, {
      health: player.health,
      hunger: player.hunger,
      oxygen: player.oxygen,
      level: player.xpLevel,
      xpProgress: player.xpCurrent / (7 + player.xpLevel * 7),
    });
    this.broadcast(PacketType.S2C_SOUND, { type: 'death', x: player.x, y: player.y, z: player.z });`,
`    const spawn = this.findSafeWorldSpawnPosition();
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.dimension = 0;
    player.health = 20;
    player.hunger = 20;
    player.oxygen = 15;
    player.isBlocking = false;
    player.shieldUseSeconds = 0;
    player.shieldDisabledSeconds = 0;
    player.hurtCooldown = createHurtCooldownState();
    player.healthAuthorityLockSeconds = 0;
    player.lastAttackTick = null;
    player.dead = false;

    this.syncPlayerInventory(player);
    this.syncPlayerState(player);
    this.sendTo(player, PacketType.S2C_JOIN_ACK, {
      playerId: player.id,
      seed: this.seed,
      x: player.x,
      y: player.y,
      z: player.z,
      gameMode: 'survival',
    });
    this.broadcastDimension(deathDimension, PacketType.S2C_SOUND, {
      type: 'death', x: deathX, y: deathY, z: deathZ
    });`,
'repeatable authoritative respawn',
);

replaceOnce(
`    this.broadcast(PacketType.S2C_DROPPED_ITEM_SPAWN, {
      id,
      itemId,
      count,
      x, y, z
    });`,
`    this.broadcastDimension(dimension, PacketType.S2C_DROPPED_ITEM_SPAWN, {
      id,
      itemId,
      count,
      x, y, z,
      dimension,
    });`,
'dimension-scoped dropped item spawn',
);

replaceOnce(
`          this.broadcast(PacketType.S2C_SOUND, { type: 'chest_open', x, y, z });`,
`          this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, { type: 'chest_open', x, y, z });`,
'dimension-scoped chest sound',
);

writeFileSync(path, source, 'utf8');

const test = `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serverSource = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');

test('direct client inventory overwrites are rejected by the server', () => {
  const start = serverSource.indexOf('case PacketType.C2S_INVENTORY_CLICK:');
  const end = serverSource.indexOf('case PacketType.C2S_INTERACT_BLOCK:', start);
  const handler = serverSource.slice(start, end);
  assert.ok(handler.includes('this.syncPlayerInventory(session)'));
  assert.equal(handler.includes('session.inventory[slotIndex] ='), false);
  assert.equal(handler.includes('session.armor[slotIndex - 100] ='), false);
});

test('server respawn clears the death guard and stale combat state', () => {
  const start = serverSource.indexOf('private handlePlayerDeath');
  const end = serverSource.indexOf('spawnDroppedItem(', start);
  const handler = serverSource.slice(start, end);
  assert.ok(handler.includes('player.dead = false'));
  assert.ok(handler.includes('player.hurtCooldown = createHurtCooldownState()'));
  assert.ok(handler.includes('player.shieldDisabledSeconds = 0'));
  assert.ok(handler.includes('player.dimension = 0'));
  assert.ok(handler.includes('this.findSafeWorldSpawnPosition()'));
});

test('death drops and dropped-item spawn remain scoped to the death dimension', () => {
  assert.ok(serverSource.includes('this.broadcastDimension(deathDimension, PacketType.S2C_SOUND'));
  assert.ok(serverSource.includes('this.broadcastDimension(dimension, PacketType.S2C_DROPPED_ITEM_SPAWN'));
});
`;
writeFileSync('tests/server-authority-contract.test.ts', test, 'utf8');
console.log('parity 91-110 authority finalizer applied');
