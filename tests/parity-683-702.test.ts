import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { inferBlockBehaviorId, inferItemBehaviorId } from '../src/world/BehaviorIds';
import { VisualResolver } from '../src/visual/VisualResolver';
import { localizeItemDisplayName } from '../src/i18nItemNames';
import {
  getJukeboxComparatorOutput,
  getJukeboxSong,
  getStoredJukeboxDisc,
  isJukeboxPlayableItemName,
} from '../src/world/JukeboxRules';
import {
  TOTEM_OF_UNDYING_EFFECTS,
  consumeTotemStack,
  findHeldTotemHand,
  isTotemOfUndyingName,
  shouldActivateTotem,
} from '../src/items/TotemRules';

const itemData = JSON.parse(
  readFileSync(new URL('../src/items/data/items.json', import.meta.url), 'utf8'),
) as Array<{
  id: number | string;
  runtimeId?: number;
  name: string;
  displayName: string;
  stackSize: number;
  officialId?: string;
}>;

const musicDiscs = itemData.filter(
  (item) => item.name.startsWith('record_') || item.name.startsWith('music_disc_'),
);

test('683: Jukebox, Music Disc, and Totem expose canonical behavior and localized identities', () => {
  assert.equal(inferBlockBehaviorId('jukebox'), 'minecraft:jukebox');
  assert.equal(inferItemBehaviorId('record_cat'), 'minecraft:music_disc');
  assert.equal(inferItemBehaviorId('music_disc_bounce'), 'minecraft:music_disc');
  assert.equal(inferItemBehaviorId('totem_of_undying'), 'minecraft:totem_of_undying');
  assert.equal(localizeItemDisplayName('zh-CN', 'jukebox', 'Jukebox'), '唱片机');
  assert.equal(localizeItemDisplayName('zh-CN', 'music_disc_bounce', 'Music Disc Bounce'), '音乐唱片 Bounce');
  assert.equal(localizeItemDisplayName('zh-TW', 'totem_of_undying', 'Totem of Undying'), '不死圖騰');
});

test('684: every current repository Music Disc is non-stackable and legacy records use canonical official ids', () => {
  assert.equal(musicDiscs.length, 22);
  assert.ok(musicDiscs.every((item) => item.stackSize === 1));
  for (const item of musicDiscs.filter((candidate) => candidate.name.startsWith('record_'))) {
    assert.match(item.officialId ?? '', /^minecraft:music_disc_/);
    assert.match(item.displayName, /^Music Disc /);
  }
  assert.equal(
    VisualResolver.getItemIconKey(ItemRegistry.getByName('record_cat')!.id),
    'item:music_disc_cat',
  );
  assert.equal(
    VisualResolver.getItemIconKey(ItemRegistry.getByName('music_disc_bounce')!.id),
    'item:music_disc_bounce',
  );
  const atlas = readFileSync(new URL('../src/engine/TextureAtlas.ts', import.meta.url), 'utf8');
  assert.ok(atlas.includes("name.startsWith('record_') || name.startsWith('music_disc_')"));
  assert.ok(atlas.includes("name === 'totem_of_undying'"));
});

test('685: every registered Music Disc is jukebox-playable', () => {
  for (const disc of musicDiscs) {
    assert.equal(isJukeboxPlayableItemName(disc.name), true, disc.name);
    assert.ok(getJukeboxSong(disc.name), disc.name);
  }
  assert.equal(isJukeboxPlayableItemName('diamond'), false);
});

test('686: classic Music Discs preserve Java comparator outputs 1 through 12', () => {
  const expected: Record<string, number> = {
    record_13: 1,
    record_cat: 2,
    record_blocks: 3,
    record_chirp: 4,
    record_far: 5,
    record_mall: 6,
    record_mellohi: 7,
    record_stal: 8,
    record_strad: 9,
    record_ward: 10,
    record_11: 11,
    record_wait: 12,
  };
  for (const [name, signal] of Object.entries(expected)) {
    assert.equal(getJukeboxComparatorOutput(name), signal, name);
  }
});

test('687: modern Music Discs use their current comparator signal strengths', () => {
  const expected: Record<string, number> = {
    music_disc_bounce: 8,
    music_disc_lava_chicken: 9,
    music_disc_tears: 10,
    music_disc_creator_music_box: 11,
    music_disc_creator: 12,
    music_disc_precipice: 13,
    music_disc_pigstep: 13,
    music_disc_relic: 14,
    music_disc_otherside: 14,
    music_disc_5: 15,
  };
  for (const [name, signal] of Object.entries(expected)) {
    assert.equal(getJukeboxComparatorOutput(name), signal, name);
  }
});

test('688: Jukebox storage owns a one-item component-preserving clone', () => {
  const source = {
    id: ItemRegistry.getByName('record_cat')!.id,
    count: 12,
    customName: 'My Cat Disc',
    enchantments: [{ id: 'mending' as const, level: 1 }],
  };
  const stored = getStoredJukeboxDisc(source);
  assert.ok(stored);
  assert.notEqual(stored, source);
  assert.equal(stored.count, 1);
  assert.equal(stored.customName, 'My Cat Disc');
  assert.notEqual(stored.enchantments, source.enchantments);
});

test('689: client Jukebox interaction is behavior-dispatched and multiplayer sends server intent first', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("id: 'minecraft:jukebox'"));
  const start = source.indexOf('private tryInteractJukebox');
  const end = source.indexOf('private tryTieLeashedMobsToFence', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('isJukeboxPlayableItemName(heldName)'));
  assert.ok(method.includes('this.isMultiplayerNetworkConnected()'));
  assert.ok(method.includes('PacketType.C2S_INTERACT_BLOCK'));
  assert.ok(method.indexOf('PacketType.C2S_INTERACT_BLOCK') < method.indexOf('this.chunks.setBlockMeta'));
});

test('690: local Jukebox insertion stores one disc, consumes survival inventory, and starts its song', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private tryInteractJukebox');
  const end = source.indexOf('private tryTieLeashedMobsToFence', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('jukeboxDisc,'));
  assert.ok(method.includes('jukeboxSong: song.songId'));
  assert.ok(method.includes('jukeboxComparatorOutput: song.comparatorOutput'));
  assert.ok(method.includes('this.inventory.removeFromSlot(this.player.selectedSlot, 1)'));
  assert.ok(method.includes('this.sound.playJukeboxSong(song.songId)'));
});

test('691: local Jukebox ejection preserves the stored stack and stops playback, including block-break ejection', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private tryInteractJukebox');
  const end = source.indexOf('private tryTieLeashedMobsToFence', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('delete nextMeta.jukeboxDisc'));
  assert.ok(method.includes('delete nextMeta.jukeboxSong'));
  assert.ok(method.includes('this.sound.stopJukeboxSong()'));
  assert.ok(method.includes('this.droppedItems.spawnStack('));
  const destroy = source.slice(source.indexOf('private destroyBlockAt'));
  assert.ok(destroy.includes('meta?.jukeboxDisc'));
  assert.ok(destroy.includes('getStoredJukeboxDisc(meta.jukeboxDisc)'));
});

test('692: Jukebox state is server authoritative, network-synchronized, persistent metadata with comparator output', () => {
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const interact = server.slice(
    server.indexOf("if (blockName === 'jukebox')"),
    server.indexOf('if (isFenceBlockName(blockName))'),
  );
  assert.ok(interact.includes('this.getBlockMetadata(x, y, z, session.dimension)'));
  assert.ok(interact.includes('this.consumeServerHeldItem(session, held)'));
  assert.ok(interact.includes('this.broadcastServerBlockUpdate'));
  assert.ok(interact.includes("type: 'jukebox'"));
  const redstone = readFileSync(new URL('../src/systems/RedstoneSystem.ts', import.meta.url), 'utf8');
  assert.ok(redstone.includes('meta.jukeboxComparatorOutput'));
  const types = readFileSync(new URL('../src/types/index.ts', import.meta.url), 'utf8');
  assert.ok(types.includes('jukeboxDisc?: ItemStack'));
  assert.ok(types.includes('jukeboxComparatorOutput?: number'));
});

test('693: Totem of Undying remains non-stackable and has canonical item identity', () => {
  const totem = itemData.find((item) => item.name === 'totem_of_undying');
  assert.ok(totem);
  assert.equal(totem.stackSize, 1);
  assert.equal(totem.officialId, 'minecraft:totem_of_undying');
  assert.equal(isTotemOfUndyingName(totem.name), true);
  assert.equal(isTotemOfUndyingName('minecraft:totem_of_undying'), true);
  assert.equal(VisualResolver.getItemIconKey(ItemRegistry.getByName('totem_of_undying')!.id), 'item:totem_of_undying');
  const player = readFileSync(new URL('../src/player/Player.ts', import.meta.url), 'utf8');
  assert.ok(player.includes("name.startsWith('record_') || name.startsWith('music_disc_')"));
  assert.ok(player.includes("name === 'totem_of_undying'"));
});

test('694: held Totem resolution prefers selected main hand over offhand', () => {
  const totemId = ItemRegistry.getByName('totem_of_undying')!.id;
  const hand = findHeldTotemHand(
    { id: totemId, count: 1 },
    { id: totemId, count: 1 },
    (id) => ItemRegistry.get(id)?.name,
  );
  assert.equal(hand, 'mainhand');
});

test('695: an offhand Totem activates when the selected main hand is not a Totem', () => {
  const totemId = ItemRegistry.getByName('totem_of_undying')!.id;
  const diamondId = ItemRegistry.getByName('diamond')!.id;
  assert.equal(
    findHeldTotemHand(
      { id: diamondId, count: 1 },
      { id: totemId, count: 1 },
      (id) => ItemRegistry.get(id)?.name,
    ),
    'offhand',
  );
  assert.equal(findHeldTotemHand(null, null, () => undefined), null);
});

test('696: Totem activation is reserved for fatal modeled damage', () => {
  assert.equal(shouldActivateTotem('mob', 0), true);
  assert.equal(shouldActivateTotem('projectile', -4), true);
  assert.equal(shouldActivateTotem('lava', 0), true);
  assert.equal(shouldActivateTotem('starve', 0.5), false);
});

test('697: Totem activation consumes exactly one held item', () => {
  assert.equal(consumeTotemStack({ id: 449, count: 1 }), null);
  assert.deepEqual(consumeTotemStack({ id: 449, count: 2, customName: 'Spare' }), {
    id: 449,
    count: 1,
    customName: 'Spare',
  });
});

test('698: Totem grants the current Regeneration II, Fire Resistance, and Absorption II durations', () => {
  assert.deepEqual(TOTEM_OF_UNDYING_EFFECTS, [
    { id: 'regeneration', level: 2, duration: 45 },
    { id: 'fire_resistance', level: 1, duration: 40 },
    { id: 'absorption', level: 2, duration: 5 },
  ]);
});

test('699: local Totem activation resets health/effects and creates eight absorption health points', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private applyTotemEffects');
  const end = source.indexOf('damagePlayer(', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('this.player.health = 1'));
  assert.ok(method.includes('this.potionEffects.clear()'));
  assert.ok(method.includes('this.player.absorption = 0'));
  assert.ok(method.includes("if (effect.id === 'absorption')"));
  assert.ok(method.includes('this.player.absorption = 4 * effect.level'));
  assert.ok(method.includes('this.sound.playTotemUse()'));
});

test('700: local fatal damage attempts held Totem activation before opening the death UI', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('damagePlayer(');
  const end = source.indexOf('\n  submitChat', start);
  const method = source.slice(start, end);
  const activate = method.indexOf('this.tryActivateHeldTotem(type, resultingHealth)');
  const death = method.indexOf("this.openUI = 'death'");
  assert.ok(activate >= 0 && death > activate);
  assert.ok(method.includes('!this.network.isConnected'));
  assert.ok(method.includes('if (!totemActivated)'));
});

test('701: server owns fatal Totem consumption, health recovery, inventory sync, and activation packet', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private applyServerDamageToPlayer');
  const end = source.indexOf('\n  // --- World interaction ---', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('findHeldTotemHand('));
  assert.ok(method.includes("totemHand === 'mainhand'"));
  assert.ok(method.includes('consumeTotemStack('));
  assert.ok(method.includes('player.health = 1'));
  assert.ok(method.includes('this.syncPlayerInventory(player)'));
  assert.ok(method.includes('PacketType.S2C_TOTEM_ACTIVATE'));
  assert.ok(method.includes("type: 'totem'"));
});

test('702: multiplayer clients apply authoritative Totem effects and Jukebox/Totem audio packets', () => {
  const protocol = readFileSync(new URL('../src/server/NetworkProtocol.ts', import.meta.url), 'utf8');
  assert.ok(protocol.includes("S2C_TOTEM_ACTIVATE = 'S2C_TOTEM_ACTIVATE'"));
  const network = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  assert.ok(network.includes('case PacketType.S2C_TOTEM_ACTIVATE'));
  assert.ok(network.includes('this.game.applyServerTotemActivation()'));
  assert.ok(network.includes("type === 'jukebox'"));
  assert.ok(network.includes('this.game.sound.playJukeboxSong(songId)'));
  assert.ok(network.includes("type === 'totem'"));
  assert.ok(network.includes('this.game.sound.playTotemUse()'));
});
