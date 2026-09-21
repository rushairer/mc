import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { inferItemBehaviorId } from '../src/world/BehaviorIds';
import { getBlockLootTable } from '../src/world/LootSystem';
import { getBlockTags, TAG_MINEABLE_SHOVEL } from '../src/world/BlockTags';
import { localizeItemDisplayName } from '../src/i18nItemNames';
import {
  BRUSH_DURABILITY,
  BRUSH_EXCAVATION_SECONDS,
  BRUSH_STAGE_COUNT,
  archaeologyBrushStage,
  archaeologyTargetKey,
  brushedReplacementName,
  isBrushExcavationComplete,
  isSuspiciousBlockName,
  normalizeArchaeologyLootCount,
} from '../src/items/ArchaeologyRules';
import {
  SERVER_BRUSH_DURATION_TICKS,
  isServerBrushDurationComplete,
  parseServerBrushAction,
  sameServerBrushTarget,
} from '../src/server/BrushActionRules';
import { isValidServerItemUseForHeldStack } from '../src/server/ServerItemUseRules';
import { PacketType } from '../src/server/NetworkProtocol';

test('723: canonical Suspicious Sand and Suspicious Gravel blocks are registered', () => {
  const sand = BlockRegistry.getByName('suspicious_sand');
  const gravel = BlockRegistry.getByName('suspicious_gravel');
  assert.ok(sand);
  assert.ok(gravel);
  assert.equal(sand!.officialId, 'minecraft:suspicious_sand');
  assert.equal(gravel!.officialId, 'minecraft:suspicious_gravel');
});

test('724: suspicious sediment inventory items place their matching existing block runtimes', () => {
  const sandItem = ItemRegistry.getByName('suspicious_sand');
  const gravelItem = ItemRegistry.getByName('suspicious_gravel');
  const sandBlock = BlockRegistry.getByName('suspicious_sand');
  const gravelBlock = BlockRegistry.getByName('suspicious_gravel');
  assert.ok(sandItem && gravelItem && sandBlock && gravelBlock);
  assert.equal(ItemRegistry.getPlaceBlockId(sandItem!.id), sandBlock!.id);
  assert.equal(ItemRegistry.getPlaceBlockId(gravelItem!.id), gravelBlock!.id);
});

test('725: Brush has a dedicated behavior identity', () => {
  assert.equal(inferItemBehaviorId('brush'), 'minecraft:brush');
  assert.equal(ItemRegistry.getByName('brush')?.behaviorId, 'minecraft:brush');
});

test('726: Brush is a one-stack 64-durability tool', () => {
  const brush = ItemRegistry.getByName('brush');
  assert.ok(brush);
  assert.equal(BRUSH_DURABILITY, 64);
  assert.equal(brush!.durability, 64);
  assert.equal(brush!.toolType, 'brush');
  assert.equal(ItemRegistry.getMaxStackSize(brush!.id), 1);
});

test('727: suspicious sediment has no normal block-break self drop', () => {
  const sand = BlockRegistry.getByName('suspicious_sand');
  const gravel = BlockRegistry.getByName('suspicious_gravel');
  assert.deepEqual(getBlockLootTable(sand), { pools: [] });
  assert.deepEqual(getBlockLootTable(gravel), { pools: [] });
});

test('728: suspicious sediment remains shovel-mineable terrain', () => {
  const sand = BlockRegistry.getByName('suspicious_sand');
  const gravel = BlockRegistry.getByName('suspicious_gravel');
  assert.ok(getBlockTags(sand).includes(TAG_MINEABLE_SHOVEL));
  assert.ok(getBlockTags(gravel).includes(TAG_MINEABLE_SHOVEL));
  assert.equal(sand?.toolCategory, 'shovel');
  assert.equal(gravel?.toolCategory, 'shovel');
});

test('729: Brush and suspicious sediment have explicit Simplified and Traditional Chinese names', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'brush', 'Brush'), '刷子');
  assert.equal(localizeItemDisplayName('zh-CN', 'suspicious_sand', 'Suspicious Sand'), '可疑的沙子');
  assert.equal(localizeItemDisplayName('zh-CN', 'suspicious_gravel', 'Suspicious Gravel'), '可疑的沙砾');
  assert.equal(localizeItemDisplayName('zh-TW', 'suspicious_gravel', 'Suspicious Gravel'), '可疑的礫石');
});

test('730: archaeology brushing completes after 4.8 seconds and exposes four progress stages', () => {
  assert.equal(BRUSH_EXCAVATION_SECONDS, 4.8);
  assert.equal(BRUSH_STAGE_COUNT, 4);
  assert.equal(archaeologyBrushStage(0), 0);
  assert.equal(archaeologyBrushStage(1.19), 0);
  assert.equal(archaeologyBrushStage(1.2), 1);
  assert.equal(archaeologyBrushStage(4.8), 4);
  assert.equal(isBrushExcavationComplete(4.79), false);
  assert.equal(isBrushExcavationComplete(4.8), true);
});

test('731: successful brushing restores suspicious sediment to its ordinary block', () => {
  assert.equal(brushedReplacementName('suspicious_sand'), 'sand');
  assert.equal(brushedReplacementName('suspicious_gravel'), 'gravel');
  assert.equal(brushedReplacementName('sand'), null);
  assert.equal(isSuspiciousBlockName('suspicious_sand'), true);
  assert.equal(isSuspiciousBlockName('dirt'), false);
});

test('732: archaeology target keys and loot counts are canonicalized defensively', () => {
  assert.equal(archaeologyTargetKey(1.9, 64.8, -2.1), '1,64,-3');
  assert.equal(normalizeArchaeologyLootCount(-5), 0);
  assert.equal(normalizeArchaeologyLootCount(1.9), 1);
  assert.equal(normalizeArchaeologyLootCount(99), 64);
  assert.equal(normalizeArchaeologyLootCount('bad'), 0);
});

test('733: Brush held visual has handle, copper collar, and bristles rather than a generic tile', () => {
  const source = readFileSync(new URL('../src/player/Player.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("name === 'brush'"));
  assert.ok(source.includes("handle.name = 'brush_handle'"));
  assert.ok(source.includes("collar.name = 'brush_collar'"));
  assert.ok(source.includes("bristles.name = 'brush_bristles'"));
});

test('734: Brush audio routes sand and gravel through dedicated resource events with fallback', () => {
  const source = readFileSync(new URL('../src/systems/SoundSystem.ts', import.meta.url), 'utf8');
  const start = source.indexOf('playBrush(');
  const end = source.indexOf('playMaceSmash(', start);
  const method = source.slice(start, end);
  assert.ok(method.includes("'item.brush.brushing.gravel'"));
  assert.ok(method.includes("'item.brush.brushing.sand'"));
  assert.ok(method.includes('this.synthNoiseCall'));
});

test('735: local Brush use participates in the continuous-use lifecycle', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("this.behaviors.registerItem('brush'");
  const end = source.indexOf("id: 'minecraft:shears'", start);
  const branch = source.slice(start, end);
  assert.ok(branch.includes('canStartUse:'));
  assert.ok(branch.includes('startUse:'));
  assert.ok(branch.includes('continueUse:'));
  assert.ok(branch.includes('stopUse:'));
  assert.ok(branch.includes('isSuspiciousBlockName'));
});

test('736: changing target or releasing/switching cancels the active Brush session', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private continueBrushUse');
  const end = source.indexOf('private completeBrushExcavation', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('archaeologyTargetKey(x, y, z) !== active.key'));
  const registration = source.slice(
    source.indexOf("this.behaviors.registerItem('brush'"),
    source.indexOf("id: 'minecraft:shears'", source.indexOf("this.behaviors.registerItem('brush'")),
  );
  assert.ok(registration.includes("action: 'cancel'"));
  assert.ok(registration.includes("progress.reason !== 'completed'"));
});

test('737: local completion converts the block, reveals natural loot, and spends one Brush durability', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private completeBrushExcavation');
  const end = source.indexOf('private setSpyglassActive', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('brushedReplacementName'));
  assert.ok(method.includes('this.chunks.setBlock(x, y, z, replacement.id)'));
  assert.ok(method.includes('meta?.archaeologyNatural'));
  assert.ok(method.includes('this.droppedItems.spawnItem'));
  assert.ok(method.includes('this.inventory.damageTool(this.player.selectedSlot, 1)'));
});

test('738: multiplayer Brush completion sends intent before any local world mutation', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private completeBrushExcavation');
  const end = source.indexOf('private setSpyglassActive', start);
  const method = source.slice(start, end);
  const network = method.indexOf('PacketType.C2S_BRUSH_ACTION');
  const localSet = method.indexOf('this.chunks.setBlock(x, y, z, replacement.id)');
  assert.ok(network >= 0 && localSet > network);
  assert.ok(method.includes("action: 'complete'"));
});

test('739: Brush network intents accept only bounded integer targets and explicit lifecycle actions', () => {
  assert.deepEqual(parseServerBrushAction({ action: 'start', itemId: 20035, x: 1, y: 64, z: -2 }), {
    action: 'start', itemId: 20035, x: 1, y: 64, z: -2,
  });
  assert.equal(parseServerBrushAction({ action: 'finish', itemId: 20035, x: 1, y: 64, z: -2 }), null);
  assert.equal(parseServerBrushAction({ action: 'start', itemId: 20035, x: 1.5, y: 64, z: -2 }), null);
  assert.equal(PacketType.C2S_BRUSH_ACTION, 'C2S_BRUSH_ACTION');
});

test('740: generic targeted item-use cannot bypass the dedicated server Brush timer', () => {
  const brush = ItemRegistry.getByName('brush');
  assert.ok(brush);
  assert.equal(isValidServerItemUseForHeldStack({
    kind: 'block',
    itemId: brush!.id,
    x: 0,
    y: 64,
    z: 0,
    face: 'up',
  }, { id: brush!.id, count: 1 }), false);
});

test('741: multiplayer Brush completion requires the same target and a full 96 server ticks', () => {
  assert.equal(SERVER_BRUSH_DURATION_TICKS, 96);
  assert.equal(isServerBrushDurationComplete(100, 195), false);
  assert.equal(isServerBrushDurationComplete(100, 196), true);
  assert.equal(sameServerBrushTarget({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 }), true);
  assert.equal(sameServerBrushTarget({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 4 }), false);

  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = server.indexOf('case PacketType.C2S_BRUSH_ACTION');
  const end = server.indexOf('case PacketType.C2S_ITEM_USE', start);
  const handler = server.slice(start, end);
  assert.ok(handler.includes('isServerBrushDurationComplete(active.startTick, this.gameTick)'));
  assert.ok(handler.includes('isBlockActionInReach'));
  assert.ok(handler.includes("heldName !== 'brush'"));
});

test('742: server completion owns replacement, natural loot, durability, and synchronized Brush audio', () => {
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = server.indexOf('private completeServerBrushExcavation');
  const end = server.indexOf('private handleServerBlockItemUse', start);
  const method = server.slice(start, end);
  assert.ok(method.includes('this.broadcastServerBlockUpdate'));
  assert.ok(method.includes('metadata?.archaeologyNatural'));
  assert.ok(method.includes('this.spawnDroppedItem'));
  assert.ok(method.includes('this.damageServerHeldTool(session, held)'));
  assert.ok(method.includes("'brush_gravel'"));
  assert.ok(method.includes("'brush_sand'"));

  const client = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  assert.ok(client.includes("type === 'brush_sand'"));
  assert.ok(client.includes("type === 'brush_gravel'"));
  const types = readFileSync(new URL('../src/types/index.ts', import.meta.url), 'utf8');
  assert.ok(types.includes('archaeologyNatural?: boolean'));
  assert.ok(types.includes('archaeologyLootItemId?: number'));
});
