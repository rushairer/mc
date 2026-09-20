import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { serverItemOnBlockKind } from '../src/server/ServerItemUseRules';
import { resolveAxeStrippedBlockName, resolveShovelPathTargetName } from '../src/world/ItemOnBlockRules';

test('533: server item-use classification recognizes Axe, Shovel, and Bone Meal without treating Pickaxes as Axes', () => {
  assert.equal(serverItemOnBlockKind('diamond_axe'), 'axe');
  assert.equal(serverItemOnBlockKind('netherite_shovel'), 'shovel');
  assert.equal(serverItemOnBlockKind('bone_meal'), 'bone_meal');
  assert.equal(serverItemOnBlockKind('diamond_pickaxe'), null);
});

test('534: multiplayer Shovel path conversion routes to server before client world mutation', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseShovel[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('this.sendServerBlockItemUse(held, target)'));
  assert.ok(method.indexOf('this.sendServerBlockItemUse(held, target)') < method.indexOf('this.chunks.setBlock('));
  assert.ok(method.includes("target.face !== 'up'"));
});

test('535: server Shovel validates top-face use, path-compatible block, and empty space above', () => {
  assert.equal(resolveShovelPathTargetName('grass_block'), 'dirt_path');
  assert.equal(resolveShovelPathTargetName('stone'), null);
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const method = source.match(/private handleServerBlockItemUse[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes("itemOnBlockKind === 'shovel'"));
  assert.ok(method.includes("intent.face !== 'up'"));
  assert.ok(method.includes('resolveShovelPathTargetName(targetBlock.name)'));
  assert.ok(method.includes('intent.y + 1'));
});

test('536: successful server Shovel conversion broadcasts Dirt Path and spends durability only through the server tool path', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const method = source.match(/private handleServerBlockItemUse[\s\S]*?\n  \}/)?.[0] ?? '';
  const shovel = method.slice(method.indexOf("itemOnBlockKind === 'shovel'"), method.indexOf("itemOnBlockKind === 'axe'"));
  assert.ok(shovel.includes("BlockRegistry.getByName('dirt_path')"));
  assert.ok(shovel.includes('this.broadcastServerBlockUpdate'));
  assert.ok(shovel.includes('this.damageServerHeldTool(session, held)'));
});

test('537: multiplayer Axe stripping routes to server before local block replacement', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseAxe[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('this.sendServerBlockItemUse(held, target)'));
  assert.ok(method.indexOf('this.sendServerBlockItemUse(held, target)') < method.indexOf('this.chunks.setBlock('));
});

test('538: server Axe stripping resolves the actual stripped block and preserves original block metadata', () => {
  assert.equal(resolveAxeStrippedBlockName('poplar_log'), 'stripped_poplar_log');
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const method = source.match(/private handleServerBlockItemUse[\s\S]*?\n  \}/)?.[0] ?? '';
  const axe = method.slice(method.indexOf("itemOnBlockKind === 'axe'"), method.indexOf("itemOnBlockKind === 'bone_meal'"));
  assert.ok(axe.includes('resolveAxeStrippedBlockName(targetBlock.name)'));
  assert.ok(axe.includes('this.getBlockMetadata(intent.x, intent.y, intent.z, session.dimension)'));
  assert.ok(axe.includes('this.broadcastServerBlockUpdate'));
  assert.ok(axe.includes('this.damageServerHeldTool(session, held)'));
});

test('539: already stripped or unsupported blocks cannot spend Axe durability through the authoritative path', () => {
  assert.equal(resolveAxeStrippedBlockName('stripped_oak_log'), null);
  assert.equal(resolveAxeStrippedBlockName('stone'), null);
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const method = source.match(/private handleServerBlockItemUse[\s\S]*?\n  \}/)?.[0] ?? '';
  const axe = method.slice(method.indexOf("itemOnBlockKind === 'axe'"), method.indexOf("itemOnBlockKind === 'bone_meal'"));
  assert.ok(axe.indexOf('if (!strippedName) return false') < axe.indexOf('this.damageServerHeldTool(session, held)'));
});

test('540: multiplayer 26.3 Bone Meal use routes Shelf Mushroom and Red Shrub to the server before mutation', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseBoneMeal26_3[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes("target.block.name !== 'shelf_mushroom' && target.block.name !== 'red_shrub'"));
  assert.ok(method.includes('this.sendServerBlockItemUse(held, target)'));
  assert.ok(method.indexOf('this.sendServerBlockItemUse(held, target)') < method.indexOf('this.chunks.setBlockMeta('));
});

test('541: server Bone Meal enlarges Shelf Mushroom metadata once and only then consumes the item', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const method = source.match(/private handleServerBlockItemUse[\s\S]*?\n  \}/)?.[0] ?? '';
  const bone = method.slice(method.indexOf("itemOnBlockKind === 'bone_meal'"), method.indexOf("itemName === 'shears'"));
  assert.ok(bone.includes("targetBlock.name === 'shelf_mushroom'"));
  assert.ok(bone.includes("metadata?.shelfMushroomSize === 'large'"));
  assert.ok(bone.includes("shelfMushroomSize: 'large'"));
  const consumeIndex = bone.indexOf('consumeHeldStack(held)');
  const successIndex = bone.indexOf("shelfMushroomSize: 'large'");
  assert.ok(successIndex >= 0 && consumeIndex > successIndex);
});

test('542: server Red Shrub Bone Meal uses deterministic 26.3 offset rotation, support checks, authoritative placement, and successful-only consumption', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const method = source.match(/private handleServerBlockItemUse[\s\S]*?\n  \}/)?.[0] ?? '';
  const bone = method.slice(method.indexOf("itemOnBlockKind === 'bone_meal'"), method.indexOf("itemName === 'shears'"));
  assert.ok(bone.includes('coordinateRandom('));
  assert.ok(bone.includes('rotateBoneMealSpreadOffsets26_3(start)'));
  assert.ok(bone.includes('this.isSolidBlock(nx, intent.y - 1, nz, session.dimension)'));
  assert.ok(bone.includes('this.broadcastServerBlockUpdate(nx, intent.y, nz, targetBlockId'));
  assert.ok(bone.includes('consumeHeldStack(held)'));
  assert.ok(bone.endsWith('return false;\n    }\n\n    if ('));
});
