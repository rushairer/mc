import assert from 'node:assert/strict';
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
  const end = serverSource.indexOf('\n  spawnDroppedItem(', start);
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
