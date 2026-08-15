import assert from 'node:assert/strict';
import test from 'node:test';
import { NetworkClient } from '../src/server/NetworkClient';
import { PacketType } from '../src/server/NetworkProtocol';

test('authoritative player state updates live systems without a stale gameState mirror', () => {
  const progressCalls: unknown[][] = [];
  let notifications = 0;
  const game = {
    player: { health: 20, hunger: 20, oxygen: 20 },
    xp: { setProgress: (...args: unknown[]) => progressCalls.push(args) },
    notifyState: () => { notifications++; },
  };
  const client = new NetworkClient(game);

  (client as any).handlePacket({
    type: PacketType.S2C_PLAYER_STATE,
    payload: { health: 12, hunger: 9, oxygen: 7, level: 4, xpProgress: 0.5 },
  });

  assert.deepEqual(game.player, { health: 12, hunger: 9, oxygen: 7 });
  assert.deepEqual(progressCalls, [[4, 0.5]]);
  assert.equal(notifications, 1);
});

test('authoritative despawn and sound packets use the actual client system APIs', () => {
  const removed: number[] = [];
  const played: string[] = [];
  const game = {
    droppedItems: { removeItem: (id: number) => removed.push(id) },
    sound: {
      playBlockBreak: () => played.push('break'),
      playBlockPlace: () => played.push('place'),
      playHurt: () => played.push('hurt'),
      playMobHurt: () => played.push('hit'),
      playPickup: () => played.push('pickup'),
      playXP: () => played.push('xp'),
      playExplosion: () => played.push('explode'),
    },
  };
  const client = new NetworkClient(game);

  (client as any).handlePacket({ type: PacketType.S2C_DROPPED_ITEM_DESPAWN, payload: { id: 42 } });
  for (const type of ['break', 'place', 'hurt', 'hit', 'pickup', 'xp', 'explode']) {
    (client as any).handlePacket({ type: PacketType.S2C_SOUND, payload: { type, x: 0, y: 0, z: 0 } });
  }

  assert.deepEqual(removed, [42]);
  assert.deepEqual(played, ['break', 'place', 'hurt', 'hit', 'pickup', 'xp', 'explode']);
});

test('P5.1 projectile spawn uses server velocity, damage and potion effect', () => {
  const spawned: unknown[] = [];
  const removed: number[] = [];
  const game = {
    projectiles: {
      spawnServerProjectile: (...args: unknown[]) => {
        spawned.push(args);
        return { id: 999 };
      },
      projectiles: new Map<number, unknown>([
        [999, { id: 999 }],
      ]),
    },
  };
  const client = new NetworkClient(game as any);

  (client as any).handlePacket({
    type: PacketType.S2C_PROJECTILE_SPAWN,
    payload: {
      id: 7,
      type: 'arrow',
      x: 10, y: 64, z: -4,
      dirX: 3, dirY: 0.5, dirZ: 0,
      damage: 9,
      potionEffect: { id: 'strength', level: 1, duration: 60 },
    },
  });

  assert.equal(spawned.length, 1);
  const [type, pos, vel, damage, effect] = spawned[0] as any[];
  assert.equal(type, 'arrow');
  assert.deepEqual([pos.x, pos.y, pos.z], [10, 64, -4]);
  assert.deepEqual([vel.x, vel.y, vel.z], [3, 0.5, 0], 'real server velocity');
  assert.equal(damage, 9);
  assert.equal(effect.id, 'strength');
  // The projectile is re-keyed to the server id.
  assert.equal(removed.length, 0);
  assert.ok((game.projectiles.projectiles as Map<number, unknown>).has(7));
});
