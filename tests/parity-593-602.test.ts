import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { VisualResolver } from '../src/visual/VisualResolver';
import { getItemTranslationKey, resolveItemPresentationIdentity } from '../src/items/ItemPresentation';
import { localizeItemDisplayName } from '../src/i18nItemNames';

const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};

test('593: Bottle o Enchanting uses its exact Simplified Chinese Minecraft name', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'experience_bottle', "Bottle o' Enchanting"), '附魔之瓶');
});

test('594: Bottle o Enchanting keeps the exact name in Traditional Chinese instead of a machine-like token mix', () => {
  assert.equal(localizeItemDisplayName('zh-TW', 'experience_bottle', "Bottle o' Enchanting"), '附魔之瓶');
});

test('595: common spawn eggs use the Minecraft 刷怪蛋 naming convention in Simplified Chinese', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'zombie_spawn_egg', 'Zombie Spawn Egg'), '僵尸刷怪蛋');
  assert.equal(localizeItemDisplayName('zh-CN', 'creeper_spawn_egg', 'Creeper Spawn Egg'), '苦力怕刷怪蛋');
});

test('596: multiword mob names stay semantic when forming Simplified Chinese spawn egg names', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'iron_golem_spawn_egg', 'Iron Golem Spawn Egg'), '铁傀儡刷怪蛋');
  assert.equal(localizeItemDisplayName('zh-CN', 'wither_skeleton_spawn_egg', 'Wither Skeleton Spawn Egg'), '凋灵骷髅刷怪蛋');
});

test('597: Traditional Chinese spawn eggs use the same 刷怪蛋 suffix with localized mob names', () => {
  assert.equal(localizeItemDisplayName('zh-TW', 'zombie_spawn_egg', 'Zombie Spawn Egg'), '殭屍刷怪蛋');
  assert.equal(localizeItemDisplayName('zh-TW', 'iron_golem_spawn_egg', 'Iron Golem Spawn Egg'), '鐵魔像刷怪蛋');
});

test('598: experience bottle keeps a dedicated item sprite identity', () => {
  const def = item('experience_bottle');
  assert.equal(VisualResolver.getItemIconKey(def.id), 'item:experience_bottle');
  assert.equal(VisualResolver.getItemVisualKind(def.id), 'sprite');
});

test('599: spawn eggs keep dedicated item sprite identity rather than block icons', () => {
  const def = item('zombie_spawn_egg');
  assert.equal(VisualResolver.getItemIconKey(def.id), 'item:zombie_spawn_egg');
  assert.equal(VisualResolver.getItemVisualKind(def.id), 'sprite');
});

test('600: presentation identity preserves Bottle o Enchanting registry/display names', () => {
  const def = item('experience_bottle');
  const identity = resolveItemPresentationIdentity(def.id);
  assert.equal(identity.kind, 'item');
  assert.equal(identity.registryName, 'experience_bottle');
  assert.equal(identity.displayName, "Bottle o' Enchanting");
});

test('601: presentation identity preserves spawn egg registry/display names', () => {
  const def = item('zombie_spawn_egg');
  const identity = resolveItemPresentationIdentity(def.id);
  assert.equal(identity.kind, 'item');
  assert.equal(identity.registryName, 'zombie_spawn_egg');
  assert.equal(identity.displayName, 'Zombie Spawn Egg');
});

test('602: translation keys distinguish item sprites from placeable blocks', () => {
  assert.equal(getItemTranslationKey(item('experience_bottle').id), 'item_experience_bottle');
  assert.equal(getItemTranslationKey(item('zombie_spawn_egg').id), 'item_zombie_spawn_egg');
});
