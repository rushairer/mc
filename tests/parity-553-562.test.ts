import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PacketType } from '../src/server/NetworkProtocol';
import {
  isServerSignStylingItemName,
  parseServerSignUpdate,
  SERVER_SIGN_LINE_MAX_LENGTH,
} from '../src/server/ServerSignRules';
import {
  applySignInteraction,
  getSignSideForPlayer,
  getSignTextForSide,
  setSignTextForSide,
} from '../src/world/SignRules';
import { isSupportedServerItemUseName } from '../src/server/ServerItemUseRules';

test('553: sign update packet is an explicit client-to-server protocol contract', () => {
  assert.equal(PacketType.C2S_SIGN_UPDATE, 'C2S_SIGN_UPDATE');
});

test('554: sign update parser accepts exactly four short single-line strings and integer coordinates', () => {
  const parsed = parseServerSignUpdate({ x: 1, y: 64, z: -2, lines: ['a', 'b', 'c', 'd'] });
  assert.deepEqual(parsed, { x: 1, y: 64, z: -2, lines: ['a', 'b', 'c', 'd'] });
  assert.equal(parseServerSignUpdate({ x: 1.5, y: 64, z: 0, lines: ['a', 'b', 'c', 'd'] }), null);
  assert.equal(parseServerSignUpdate({ x: 1, y: 64, z: 0, lines: ['a'] }), null);
});

test('555: server sign parser rejects overlong or multiline payloads instead of trusting UI limits', () => {
  assert.equal(parseServerSignUpdate({
    x: 0, y: 64, z: 0,
    lines: ['x'.repeat(SERVER_SIGN_LINE_MAX_LENGTH + 1), '', '', ''],
  }), null);
  assert.equal(parseServerSignUpdate({ x: 0, y: 64, z: 0, lines: ['a\nb', '', '', ''] }), null);
});

test('556: sign styling item classification covers wax dye glow and ink while rejecting unrelated items', () => {
  for (const name of ['honeycomb', 'red_dye', 'blue_dye', 'glow_ink_sac', 'ink_sac']) {
    assert.equal(isServerSignStylingItemName(name), true);
    assert.equal(isSupportedServerItemUseName(name, 'block'), true);
  }
  assert.equal(isServerSignStylingItemName('diamond'), false);
});

test('557: multiplayer sign styling sends item-use intent before any local metadata mutation or consumption', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("id: 'minecraft:sign'");
  const end = source.indexOf("id: 'minecraft:readable'", start);
  const handler = source.slice(start, end);
  const send = handler.indexOf('this.sendServerBlockItemUse(heldItem, context)');
  const mutate = handler.indexOf('this.chunks.setBlockMeta');
  assert.ok(send >= 0 && mutate > send);
  assert.ok(handler.includes('if (!this.isMultiplayerNetworkConnected())'));
});

test('558: multiplayer sign text save sends only coordinates and four bounded lines instead of writing metadata optimistically', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/saveSignText\(lines: string\[\]\)[\s\S]*?\n  \}/)?.[0] ?? '';
  const send = method.indexOf('PacketType.C2S_SIGN_UPDATE');
  const mutate = method.indexOf('this.chunks.setBlockMeta');
  assert.ok(send >= 0 && mutate > send);
  assert.ok(method.includes("slice(0, 15)"));
});

test('559: server sign text update validates reach and the actual target block before mutating metadata', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_SIGN_UPDATE');
  const end = source.indexOf('case PacketType.C2S_VEHICLE_INTERACT', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('parseServerSignUpdate'));
  assert.ok(handler.includes('isBlockActionInReach(session, intent.x, intent.y, intent.z, session.gameMode)'));
  assert.ok(handler.includes('isSignBlockName(block.name)'));
});

test('560: server derives the edited sign side from authoritative player position and rejects waxed signs', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_SIGN_UPDATE');
  const end = source.indexOf('case PacketType.C2S_VEHICLE_INTERACT', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('getSignSideForPlayer('));
  assert.ok(handler.includes('session.x'));
  assert.ok(handler.includes('session.z'));
  assert.ok(handler.includes('if (metadata.signWaxed) break'));
});

test('561: side-specific text updates preserve the opposite side and side selection follows sign orientation', () => {
  const front = setSignTextForSide(undefined, 'front', ['front', '', '', '']);
  const both = setSignTextForSide(front, 'back', ['back', '', '', '']);
  assert.equal(getSignTextForSide(both, 'front')[0], 'front');
  assert.equal(getSignTextForSide(both, 'back')[0], 'back');
  assert.equal(getSignSideForPlayer('oak_wall_sign', { facing: 'north' }, 0, 0, 0.5, -2), 'front');
});

test('562: successful server sign styling consumes only after applySignInteraction and broadcasts authoritative metadata', () => {
  const styled = applySignInteraction(undefined, 'red_dye', 'front');
  assert.equal(styled.consumeItem, true);
  assert.equal(styled.metadata.signColorFront, 'red');

  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('isSignBlockName(targetBlock.name) && isServerSignStylingItemName(itemName)');
  const end = source.indexOf('const itemOnBlockKind = serverItemOnBlockKind(itemName)', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('applySignInteraction(metadata, itemName, side)'));
  assert.ok(handler.includes('if (!result.consumeItem) return false'));
  assert.ok(handler.includes('this.broadcastServerBlockUpdate'));
  assert.ok(handler.indexOf('this.consumeServerHeldItem(session, held)') > handler.indexOf('applySignInteraction(metadata, itemName, side)'));
});
