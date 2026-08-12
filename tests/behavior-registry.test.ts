import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlockDef } from '../src/types';
import type { ItemDef } from '../src/items/ItemRegistry';
import {
  BehaviorRegistry,
  type BlockInteractionContext,
  type ItemInteractionContext,
} from '../src/world/BehaviorRegistry';

function block(name: string, behaviorId?: string): BlockDef {
  return {
    id: 1,
    name,
    textureKey: name,
    transparent: false,
    solid: true,
    hardness: 1,
    luminance: 0,
    behaviorId,
  };
}

function context(definition: BlockDef): BlockInteractionContext {
  return {
    position: { x: 1, y: 2, z: 3 },
    blockId: definition.id,
    block: definition,
    heldItem: null,
  };
}

test('dispatches a block interaction through a registered alias', () => {
  const registry = new BehaviorRegistry();
  registry.registerBlock(['campfire', 'soul_campfire'], {
    id: 'minecraft:campfire',
    interact: ({ position }) => ({ handled: position.y === 2, cooldown: 0.25 }),
  });

  assert.deepEqual(registry.interactBlock(context(block('soul_campfire'))), {
    handled: true,
    cooldown: 0.25,
  });
});

test('BlockDef behaviorId can select behavior without a name alias', () => {
  const registry = new BehaviorRegistry();
  registry.registerBlock('cake', {
    id: 'minecraft:cake',
    interact: () => ({ handled: true }),
  });

  assert.deepEqual(
    registry.interactBlock(context(block('custom_cake', 'minecraft:cake'))),
    { handled: true },
  );
});

test('unregistered blocks fall through without claiming the interaction', () => {
  const registry = new BehaviorRegistry();
  assert.equal(registry.interactBlock(context(block('stone'))), undefined);
});

test('block behavior declares whether it prevents fallback item use', () => {
  const registry = new BehaviorRegistry();
  registry.registerBlock('chest', {
    id: 'minecraft:storage',
    preventsItemUse: ({ heldItem }) => heldItem?.id === 1,
  });

  const chestContext = context(block('chest'));
  assert.equal(registry.preventsItemUse(chestContext), false);
  assert.equal(registry.preventsItemUse({
    ...chestContext,
    heldItem: { id: 1, count: 1 },
  }), true);
});

test('ItemDef behaviorId dispatches through the item behavior registry', () => {
  const registry = new BehaviorRegistry();
  registry.registerItem('map', {
    id: 'minecraft:readable',
    use: ({ stack }) => ({ handled: stack.count > 0, cooldown: 0.35 }),
  });
  const item: ItemDef = {
    id: 395,
    officialId: 'minecraft:custom_map',
    baseId: 395,
    metadata: 0,
    name: 'custom_map',
    displayName: 'Custom Map',
    maxStackSize: 64,
    category: 'material',
    behaviorId: 'minecraft:readable',
  };

  assert.deepEqual(registry.useItem({ item, stack: { id: 395, count: 1 } }), {
    handled: true,
    cooldown: 0.35,
  });
});

test('dispatches entity interaction aliases without coupling target types', () => {
  type Target = { id: number; type: string };
  const registry = new BehaviorRegistry<
    BlockInteractionContext,
    ItemInteractionContext,
    { target: Target; heldItem: { id: number; count: number } | null }
  >();
  registry.registerEntity(['mob:wolf', 'mob:cat'], {
    id: 'minecraft:pet',
    interact: ({ target, heldItem }) => ({
      handled: target.id === 7 && heldItem?.id === 352,
      cooldown: 0.25,
    }),
  });

  assert.deepEqual(registry.interactEntity('mob:wolf', {
    target: { id: 7, type: 'wolf' },
    heldItem: { id: 352, count: 1 },
  }), { handled: true, cooldown: 0.25 });
  assert.equal(registry.interactEntity('mob:zombie', {
    target: { id: 8, type: 'zombie' },
    heldItem: null,
  }), undefined);
});

test('dispatches continuous item-use lifecycle with explicit progress and stop reason', () => {
  const events: string[] = [];
  const registry = new BehaviorRegistry();
  registry.registerItem('bow', {
    id: 'minecraft:bow',
    canStartUse: ({ stack }) => stack.count > 0,
    startUse: () => {
      events.push('start');
      return { handled: true };
    },
    continueUse: (_context, progress) => {
      events.push(`continue:${progress.elapsedSeconds}`);
      return { handled: true };
    },
    stopUse: (_context, progress) => {
      events.push(`stop:${progress.reason}:${progress.stillSelected}`);
      return { handled: true, cooldown: 0.5 };
    },
  });
  const item: ItemDef = {
    id: 261,
    officialId: 'minecraft:bow',
    baseId: 261,
    metadata: 0,
    name: 'bow',
    displayName: 'Bow',
    maxStackSize: 1,
    category: 'tool',
  };
  const useContext = { item, stack: { id: 261, count: 1 } };

  assert.equal(registry.canStartItemUse(useContext), true);
  assert.deepEqual(registry.startItemUse(useContext), { handled: true });
  assert.deepEqual(registry.continueItemUse(useContext, {
    deltaSeconds: 0.05,
    elapsedSeconds: 0.5,
  }), { handled: true });
  assert.deepEqual(registry.stopItemUse(useContext, {
    deltaSeconds: 0,
    elapsedSeconds: 0.5,
    reason: 'released',
    stillSelected: true,
  }), { handled: true, cooldown: 0.5 });
  assert.deepEqual(events, ['start', 'continue:0.5', 'stop:released:true']);
});
