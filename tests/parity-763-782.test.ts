import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { inferBlockBehaviorId } from '../src/world/BehaviorIds';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { cloneItemStack } from '../src/items/ItemStackRules';
import { findCraftingResult } from '../src/items/CraftingRecipes';
import { localizeItemDisplayName } from '../src/i18nItemNames';
import { GameRuleSystem } from '../src/systems/GameRuleSystem';
import { VisualResolver } from '../src/visual/VisualResolver';
import { canExecuteServerCommand } from '../src/server/ServerCommandRules';
import {
  BRICK_ITEM_ID,
  craftDecoratedPot,
  createDecoratedPotMetadata,
  decoratedPotBreakDrops,
  decoratedPotComparatorSignal,
  defaultDecoratedPotDecorations,
  insertOneIntoDecoratedPot,
  isDecoratedPotBreakingTool,
  isDecoratedPotIngredient,
  isPotterySherdName,
} from '../src/items/DecoratedPotRules';

const pot = () => BlockRegistry.getByName('decorated_pot')!;
const sherd = (name: string) => ItemRegistry.getByName(name)!;

test('763: Decorated Pot is a registered placeable block with its dedicated behavior', () => {
  const block = pot();
  assert.ok(block);
  assert.equal(block.name, 'decorated_pot');
  assert.equal(inferBlockBehaviorId(block.name), 'minecraft:decorated_pot');
  const item = ItemRegistry.get(block.id);
  assert.ok(item);
  assert.equal(item!.placeBlockId, block.id);
  assert.equal(item!.maxStackSize, 64);
});

test('764: all 23 Java pottery sherd items and Brick are accepted as pot decorations', () => {
  const sherds = ItemRegistry.all().filter((item) => isPotterySherdName(item.name));
  assert.equal(sherds.length, 23);
  for (const item of sherds) assert.equal(isDecoratedPotIngredient({ id: item.id, count: 1 }), true);
  assert.equal(isDecoratedPotIngredient({ id: BRICK_ITEM_ID, count: 1 }), true);
  assert.equal(isDecoratedPotIngredient({ id: ItemRegistry.getByName('diamond')!.id, count: 1 }), false);
});

test('765: cross-shaped Decorated Pot crafting preserves four full ItemStack decoration components', () => {
  const angler = sherd('angler_pottery_sherd');
  const archer = sherd('archer_pottery_sherd');
  const brewer = sherd('brewer_pottery_sherd');
  const skull = sherd('skull_pottery_sherd');
  const result = craftDecoratedPot([
    null, { id: angler.id, count: 1, customName: 'Back' }, null,
    { id: archer.id, count: 1, customName: 'Left' }, null, { id: brewer.id, count: 1, customName: 'Right' },
    null, { id: skull.id, count: 1, customName: 'Front' }, null,
  ]);
  assert.equal(result?.id, pot().id);
  assert.equal(result?.potDecorations?.back?.customName, 'Back');
  assert.equal(result?.potDecorations?.left?.customName, 'Left');
  assert.equal(result?.potDecorations?.right?.customName, 'Right');
  assert.equal(result?.potDecorations?.front?.customName, 'Front');
});

test('766: Decorated Pot crafting rejects stray slots and the ordinary recipe path supports four Bricks', () => {
  const invalid = craftDecoratedPot([
    { id: BRICK_ITEM_ID, count: 1 }, { id: BRICK_ITEM_ID, count: 1 }, null,
    { id: BRICK_ITEM_ID, count: 1 }, null, { id: BRICK_ITEM_ID, count: 1 },
    null, { id: BRICK_ITEM_ID, count: 1 }, null,
  ]);
  assert.equal(invalid, null);
  const result = findCraftingResult([
    0, BRICK_ITEM_ID, 0,
    BRICK_ITEM_ID, 0, BRICK_ITEM_ID,
    0, BRICK_ITEM_ID, 0,
  ]);
  assert.equal(result?.id, pot().id);
  assert.deepEqual(result?.potDecorations, defaultDecoratedPotDecorations());
});

test('767: ItemStack cloning deep-clones all four pot decoration stacks', () => {
  const original = {
    id: pot().id,
    count: 1,
    potDecorations: {
      back: { id: sherd('angler_pottery_sherd').id, count: 1, customName: 'A' },
      left: { id: BRICK_ITEM_ID, count: 1 },
      right: { id: sherd('brewer_pottery_sherd').id, count: 1 },
      front: { id: sherd('skull_pottery_sherd').id, count: 1 },
    },
  };
  const cloned = cloneItemStack(original)!;
  assert.deepEqual(cloned, original);
  assert.notEqual(cloned.potDecorations, original.potDecorations);
  assert.notEqual(cloned.potDecorations?.back, original.potDecorations.back);
});

test('768: placing a Decorated Pot creates a one-slot container and preserves decorations', () => {
  const stack = {
    id: pot().id,
    count: 1,
    potDecorations: {
      front: { id: sherd('skull_pottery_sherd').id, count: 1, customName: 'face' },
    },
  };
  const metadata = createDecoratedPotMetadata(stack, 'north');
  assert.equal(metadata.containerType, 'decorated_pot');
  assert.equal(metadata.inventory?.length, 1);
  assert.equal(metadata.inventory?.[0], null);
  assert.equal(metadata.potDecorations?.front?.customName, 'face');
  assert.equal(metadata.potDecorations?.back?.id, BRICK_ITEM_ID);
});

test('769: right-click insertion moves exactly one item and respects stack compatibility and capacity', () => {
  const diamond = ItemRegistry.getByName('diamond')!;
  let meta = createDecoratedPotMetadata({ id: pot().id, count: 1 });
  let held = { id: diamond.id, count: 3, customName: 'kept' };
  const first = insertOneIntoDecoratedPot(meta, held, false);
  assert.equal(first.inserted, 1);
  assert.equal(first.metadata.inventory?.[0]?.count, 1);
  assert.equal(first.metadata.inventory?.[0]?.customName, 'kept');
  assert.equal(first.held?.count, 2);

  meta = first.metadata;
  const mismatch = insertOneIntoDecoratedPot(meta, { id: diamond.id, count: 1, customName: 'different' }, false);
  assert.equal(mismatch.inserted, 0);

  meta.inventory = [{ id: diamond.id, count: 64, customName: 'kept' }];
  const full = insertOneIntoDecoratedPot(meta, held, false);
  assert.equal(full.inserted, 0);
});

test('770: Decorated Pot comparator signal tracks the fullness of its one stored stack', () => {
  const diamond = ItemRegistry.getByName('diamond')!;
  const meta = createDecoratedPotMetadata({ id: pot().id, count: 1 });
  assert.equal(decoratedPotComparatorSignal(meta), 0);
  meta.inventory = [{ id: diamond.id, count: 1 }];
  assert.equal(decoratedPotComparatorSignal(meta), 1);
  meta.inventory = [{ id: diamond.id, count: 32 }];
  assert.equal(decoratedPotComparatorSignal(meta), 8);
  meta.inventory = [{ id: diamond.id, count: 64 }];
  assert.equal(decoratedPotComparatorSignal(meta), 15);
});

test('771: pot-breaking tools include tool families, Trident, Mace, and Java 26.3 Spears', () => {
  for (const name of ['iron_sword', 'iron_axe', 'iron_pickaxe', 'iron_shovel', 'iron_hoe', 'trident', 'mace', 'iron_spear']) {
    const item = ItemRegistry.getByName(name);
    assert.ok(item, name);
    assert.equal(isDecoratedPotBreakingTool({ id: item!.id, count: 1 }), true, name);
  }
  assert.equal(isDecoratedPotBreakingTool({ id: BRICK_ITEM_ID, count: 1 }), false);
});

test('772: tool break shatters into four decorations while hand or Silk Touch returns the intact pot', () => {
  const skull = sherd('skull_pottery_sherd');
  const metadata = createDecoratedPotMetadata({
    id: pot().id,
    count: 1,
    potDecorations: {
      front: { id: skull.id, count: 1, customName: 'Skull face' },
    },
  });
  const pickaxe = ItemRegistry.getByName('iron_pickaxe')!;
  const shattered = decoratedPotBreakDrops(metadata, { id: pickaxe.id, count: 1 }, false, false);
  assert.equal(shattered.length, 4);
  assert.equal(shattered.find((stack) => stack.id === skull.id)?.customName, 'Skull face');
  const intact = decoratedPotBreakDrops(metadata, null, false, false);
  assert.equal(intact.length, 1);
  assert.equal(intact[0].id, pot().id);
  assert.equal(intact[0].potDecorations?.front?.customName, 'Skull face');
  assert.equal(decoratedPotBreakDrops(metadata, { id: pickaxe.id, count: 1 }, true, false)[0].id, pot().id);
});

test('773: Decorated Pot has explicit natural Chinese names', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'decorated_pot', 'Decorated Pot'), '饰纹陶罐');
  assert.equal(localizeItemDisplayName('zh-TW', 'decorated_pot', 'Decorated Pot'), '飾紋陶罐');
});

test('774: projectilesCanBreakBlocks defaults on and remains a writable gamerule', () => {
  const rules = new GameRuleSystem();
  assert.equal(rules.getRule('projectilesCanBreakBlocks'), true);
  rules.setRule('projectilesCanBreakBlocks', false);
  assert.equal(rules.getRule('projectilesCanBreakBlocks'), false);
  assert.equal(canExecuteServerCommand('/gamerule projectilesCanBreakBlocks false', true), true);
  assert.equal(canExecuteServerCommand('/gamerule projectilesCanBreakBlocks false', false), false);
});

test('775: Decorated Pot visuals use a pot icon and the actual sherd item texture on decorated faces', () => {
  const block = pot();
  const skull = sherd('skull_pottery_sherd');
  const meta = createDecoratedPotMetadata({
    id: block.id,
    count: 1,
    potDecorations: { front: { id: skull.id, count: 1 } },
  });
  assert.equal(VisualResolver.getBlockFaceTexture(block.id, 4, meta), 'item:skull_pottery_sherd');
  assert.equal(VisualResolver.getBlockFaceTexture(block.id, 2, meta), 'block:decorated_pot');
  assert.equal(VisualResolver.getItemIconKey(block.id), 'icon:block:decorated_pot');
  assert.equal(VisualResolver.getItemVisualKind(block.id), 'sprite');
});

test('776: Chunk rendering has a dedicated three-part Decorated Pot path before plant-cross rendering', () => {
  const source = readFileSync(new URL('../src/world/Chunk.ts', import.meta.url), 'utf8');
  const potStart = source.indexOf("if (def.name === 'decorated_pot')");
  const plantStart = source.indexOf('if (def.transparent && !def.solid && !BlockRegistry.isFluid(id))');
  assert.ok(potStart >= 0 && potStart < plantStart);
  const branch = source.slice(potStart, plantStart);
  assert.ok(branch.includes('minX: 1 / 16, maxX: 15 / 16'));
  assert.ok(branch.includes('minY: 14 / 16, maxY: 1'));
  assert.ok(branch.includes('decorated_pot_top'));
});

test('777: local placement and interaction bind Decorated Pot rules instead of treating it as a generic block', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("id: 'minecraft:decorated_pot'"));
  assert.ok(source.includes('this.tryInsertDecoratedPot(position.x, position.y, position.z, heldItem)'));
  assert.ok(source.includes('this.setPlacedBlockMetadata(x, y, z, plan.blockId, plan.facing, stack)'));
  assert.ok(source.includes('createDecoratedPotMetadata(placedStack, facing)'));
});

test('778: local container destruction preserves complete ItemStack components and projectile impact reaches fragile blocks', () => {
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const destroy = game.slice(game.indexOf('private destroyBlockAt'), game.indexOf('private restoreRedstoneFromLoadedChunks'));
  assert.ok(destroy.includes('this.droppedItems.spawnStack(slot, dropPos, velocity, 0.5)'));
  assert.ok(game.includes('tryShatterDecoratedPotFromProjectile'));
  assert.ok(game.includes("this.gamerules.getRule('projectilesCanBreakBlocks')"));
  const projectile = readFileSync(new URL('../src/systems/ProjectileSystem.ts', import.meta.url), 'utf8');
  assert.ok(projectile.includes('onProjectileImpact(proj.type, proj.position.clone(), proj.fromPlayer)'));
});

test('779: multiplayer placement and insertion derive Decorated Pot state from authoritative server stacks', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const placeStart = source.indexOf('case PacketType.C2S_BLOCK_PLACE');
  const placeEnd = source.indexOf('case PacketType.C2S_CHAT', placeStart);
  const placement = source.slice(placeStart, placeEnd);
  assert.ok(placement.includes("block?.name === 'decorated_pot'"));
  assert.ok(placement.includes('createDecoratedPotMetadata(held, plan.facing)'));

  const interactStart = source.indexOf('case PacketType.C2S_INTERACT_BLOCK');
  const interactEnd = source.indexOf('case PacketType.C2S_SIGN_UPDATE', interactStart);
  const interaction = source.slice(interactStart, interactEnd);
  assert.ok(interaction.includes("blockName === 'decorated_pot'"));
  assert.ok(interaction.includes('insertOneIntoDecoratedPot(currentMeta, held, session.gameMode ==='));
  assert.ok(interaction.includes('session.inventory[session.selectedSlot] = result.held'));
  assert.ok(interaction.includes('this.syncPlayerInventory(session)'));
});

test('780: server block break preserves pot contents and owns Silk Touch/tool shatter decisions', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_BLOCK_BREAK');
  const end = source.indexOf('case PacketType.C2S_BLOCK_PLACE', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes("blockDef?.name === 'decorated_pot'"));
  assert.ok(handler.includes("EnchantSystem.getLevel(tool, 'silk_touch')"));
  assert.ok(handler.includes('decoratedPotBreakDrops(blockMeta, tool, silkTouch, false)'));
  assert.ok(handler.includes('this.spawnDroppedStack(stack'));
});

test('781: server projectile shatter obeys projectilesCanBreakBlocks and broadcasts authoritative block removal', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private shatterServerDecoratedPot');
  const end = source.indexOf('private tickProjectiles', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('if (!this.projectilesCanBreakBlocks) return false'));
  assert.ok(method.includes('decoratedPotBreakDrops(meta, null, false, true)'));
  assert.ok(method.includes('blockId: 0, metadata: null'));
  const tick = source.slice(source.indexOf('private tickProjectiles'), source.indexOf('private attemptMobSpawning'));
  assert.ok(tick.includes('this.shatterServerDecoratedPot(px, py, pz, proj.dimension)'));
  assert.ok(source.includes("case 'gamerule'"));
});

test('782: Decorated Pot is collidable and owns recognizable fallback textures instead of plant rendering', () => {
  const blocks = JSON.parse(readFileSync(new URL('../src/items/data/blocks.json', import.meta.url), 'utf8'));
  const def = blocks.find((entry: any) => entry.name === 'decorated_pot');
  assert.equal(def?.boundingBox, 'block');
  assert.equal(def?.transparent, true);
  const atlas = readFileSync(new URL('../src/engine/TextureAtlas.ts', import.meta.url), 'utf8');
  assert.ok(atlas.includes("this.drawTile('decorated_pot'"));
  assert.ok(atlas.includes("this.drawTile('decorated_pot_top'"));
  assert.ok(atlas.includes("b.name === 'decorated_pot'"));
});
