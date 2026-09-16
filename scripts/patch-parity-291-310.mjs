import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) {
    throw new Error(`Expected patch anchor not found in ${path}: ${before.slice(0, 120)}`);
  }
  write(path, source.replace(before, after));
}

function insertBefore(path, marker, content) {
  const source = read(path);
  if (!source.includes(marker)) throw new Error(`Marker not found in ${path}: ${marker}`);
  write(path, source.replace(marker, `${content}${marker}`));
}

// 291-295: one authoritative presentation identity for legacy and modern runtime IDs.
write('src/items/ItemPresentation.ts', `import { ItemRegistry, type ItemDef } from './ItemRegistry';
import { BlockRegistry, type BlockDef } from '../world/BlockRegistry';

export type ItemPresentationKind = 'block' | 'item';

export interface ItemPresentationIdentity {
  item?: ItemDef;
  block?: BlockDef;
  kind: ItemPresentationKind;
  registryName: string;
  displayName?: string;
  placeBlockId?: number;
}

function normalizeFallbackName(value = ''): string {
  return value
    .replace(/^minecraft:/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Resolves the semantic identity used by names/icons. Do not infer block-ness
 * from numeric runtime ID ranges: modern Java content uses arbitrary runtime IDs.
 */
export function resolveItemPresentationIdentity(
  itemId: number,
  fallbackName?: string,
): ItemPresentationIdentity {
  const item = ItemRegistry.get(itemId);
  const placeBlockId = ItemRegistry.getPlaceBlockId(itemId);
  const block = placeBlockId !== undefined ? BlockRegistry.get(placeBlockId) : undefined;
  const kind: ItemPresentationKind = placeBlockId !== undefined ? 'block' : 'item';
  const registryName = (block?.name ?? item?.name ?? normalizeFallbackName(fallbackName)).replace(/^minecraft:/, '');
  return {
    item,
    block,
    kind,
    registryName,
    displayName: item?.displayName ?? block?.displayName ?? fallbackName,
    placeBlockId,
  };
}

export function getItemTranslationKey(itemId: number, fallbackName?: string): string {
  const identity = resolveItemPresentationIdentity(itemId, fallbackName);
  return `${identity.kind}_${identity.registryName}`;
}
`);

replaceOnce(
  'src/i18n.tsx',
  "import { localizeItemDisplayName } from './i18nItemNames';",
  "import { localizeItemDisplayName } from './i18nItemNames';\nimport { resolveItemPresentationIdentity } from './items/ItemPresentation';",
);

const oldLocalized = `  const getLocalizedItemName = (id: number, fallbackName?: string): string => {
    const isBlock = (id & 0x3FF) < 256;
    const prefix = isBlock ? 'block_' : 'item_';

    let lookupName = '';

    // Get exact name from registry
    if (isBlock) {
      lookupName = BlockRegistry.get(id)?.name ?? '';
    } else {
      lookupName = ItemRegistry.get(id)?.name ?? '';
    }

    if (!lookupName && fallbackName) {
      lookupName = fallbackName.toLowerCase().replace(/\\s+/g, '_');
    }
    // Remove namespaces
    lookupName = lookupName.replace(/^minecraft:/, '');

    // Check direct static translation first
    const key = \`${'${prefix}'}${'${lookupName}'}\` as keyof TranslationsSchema;
    const localized = translations[locale][key] as string;
    if (localized) {
      return localized;
    }

    if (locale !== 'en' && lookupName) {
      return localizeItemDisplayName(locale, lookupName, fallbackName);
    }

    if (fallbackName) return fallbackName;
    return lookupName.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase()) || 'Unknown';
  };`;

const newLocalized = `  const getLocalizedItemName = (id: number, fallbackName?: string): string => {
    const identity = resolveItemPresentationIdentity(id, fallbackName);
    const lookupName = identity.registryName;
    const prefix = identity.kind === 'block' ? 'block_' : 'item_';

    const key = \`${'${prefix}'}${'${lookupName}'}\` as keyof TranslationsSchema;
    const localized = translations[locale][key] as string;
    if (localized) return localized;

    if (locale !== 'en' && lookupName) {
      return localizeItemDisplayName(locale, lookupName, identity.displayName ?? fallbackName);
    }

    if (identity.displayName) return identity.displayName;
    if (fallbackName) return fallbackName;
    return lookupName.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase()) || 'Unknown';
  };`;
replaceOnce('src/i18n.tsx', oldLocalized, newLocalized);

replaceOnce(
  'src/visual/VisualResolver.ts',
  `    const item = ItemRegistry.get(itemId);\n    if (!item) return 'item:unknown';\n    return \`item:${'${item.name}'}\`;`,
  `    const item = ItemRegistry.get(itemId);\n    if (!item) return 'item:unknown';\n    // Java explorer maps share the filled-map inventory sprite; their destination\n    // is represented by map data rather than a bespoke item texture.\n    if (item.behaviorId === 'minecraft:readable' && item.name.endsWith('_map')) {\n      return 'item:filled_map';\n    }\n    return \`item:${'${item.name}'}\`;`,
);

// 296-300: all block items, including Straw Bed, must flow through block_item placement.
replaceOnce(
  'src/world/WildernessBound26_3.ts',
  "    behaviorId: block.name === 'straw_bed' ? 'minecraft:straw_bed' : undefined,",
  "    behaviorId: 'minecraft:block_item',",
);

replaceOnce(
  'src/world/BlockPlacement.ts',
  `  const baseId = blockId & 0x3FF;\n  const blockBelow = world.getBlock({ x: position.x, y: position.y - 1, z: position.z }) & 0x3FF;\n  if (baseId === 115 && blockBelow !== 88) {\n    return { ok: false, reason: 'invalid_support' };\n  }\n  if ((baseId === 59 || baseId === 141 || baseId === 142) && blockBelow !== 60) {\n    return { ok: false, reason: 'invalid_support' };\n  }\n\n  const isDoor = isDoorName(request.item.name) || isDoorName(blockName);\n  const isBed = baseId === 26 || blockName === 'bed' || blockName.endsWith('_bed');`,
  `  // Only apply legacy packed-ID support rules to legacy blocks. Modern runtime\n  // IDs may have low 10 bits that coincidentally equal an old block ID.\n  const registeredBaseId = block?.baseId ?? blockId;\n  const legacyBaseId = registeredBaseId < 256 ? registeredBaseId & 0x3FF : undefined;\n  const blockBelowId = world.getBlock({ x: position.x, y: position.y - 1, z: position.z });\n  const blockBelow = BlockRegistry.get(blockBelowId);\n  const registeredBelowBaseId = blockBelow?.baseId ?? blockBelowId;\n  const legacyBelowBaseId = registeredBelowBaseId < 256 ? registeredBelowBaseId & 0x3FF : undefined;\n  if ((legacyBaseId === 115 || blockName === 'nether_wart') && legacyBelowBaseId !== 88 && blockBelow?.name !== 'soul_sand') {\n    return { ok: false, reason: 'invalid_support' };\n  }\n  if (\n    (legacyBaseId === 59 || legacyBaseId === 141 || legacyBaseId === 142 || ['wheat', 'carrots', 'potatoes'].includes(blockName))\n    && legacyBelowBaseId !== 60\n    && blockBelow?.name !== 'farmland'\n  ) {\n    return { ok: false, reason: 'invalid_support' };\n  }\n\n  const isDoor = isDoorName(request.item.name) || isDoorName(blockName);\n  const isBed = legacyBaseId === 26 || blockName === 'bed' || blockName.endsWith('_bed');`,
);

// 301-306: wire the Straw Bed block behavior into the real right-click runtime.
replaceOnce(
  'src/engine/Game.ts',
  "import { fallingLeafParticle26_3, shouldPrioritizeShieldUse26_3 } from '../world/WildernessBoundChanges26_3';",
  "import { fallingLeafParticle26_3, shouldPrioritizeShieldUse26_3 } from '../world/WildernessBoundChanges26_3';\nimport { useStrawBed as resolveStrawBedUse26_3 } from '../world/WildernessBound26_3';",
);

const bedBehavior = `    this.behaviors.registerBlock('bed', {
      id: 'minecraft:bed',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.useBed(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.25 };
      },
    });
`;
const strawBehavior = `${bedBehavior}    this.behaviors.registerBlock([], {
      id: 'minecraft:straw_bed',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.useStrawBed26_3(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.25 };
      },
    });
`;
replaceOnce('src/engine/Game.ts', bedBehavior, strawBehavior);

const strawMethod = `  private useStrawBed26_3(x: number, y: number, z: number) {
    const dimensionName = this.chunks.currentDimension === Dimension.Overworld
      ? 'overworld'
      : this.chunks.currentDimension === Dimension.Nether
        ? 'nether'
        : 'end';
    const outcome = resolveStrawBedUse26_3(dimensionName);
    const metadata = this.chunks.getBlockMeta(x, y, z);
    const facing = metadata?.facing ?? 'north';
    const forward = facing === 'east'
      ? { x: 1, z: 0 }
      : facing === 'west'
        ? { x: -1, z: 0 }
        : facing === 'south'
          ? { x: 0, z: 1 }
          : { x: 0, z: -1 };
    const direction = metadata?.bedPart === 'head' ? -1 : 1;
    const positions = [
      { x, y, z },
      { x: x + forward.x * direction, y, z: z + forward.z * direction },
    ];

    for (const position of positions) {
      const id = this.chunks.getBlock(position.x, position.y, position.z);
      if (BlockRegistry.get(id)?.name !== 'straw_bed') continue;
      this.chunks.setBlock(position.x, position.y, position.z, 0);
      this.chunks.setBlockMeta(position.x, position.y, position.z, null, true);
      this.redstone.observeBlockChange(position.x, position.y, position.z);
    }

    if (outcome.canSleep) {
      // Straw Beds skip the night but intentionally never mutate bedSpawnPoint.
      if (this.gameTime >= 0.5) this.gameTime = 0.05;
      this.advancements.checkSleep();
      this.sound.playBlockPlace(35);
    } else {
      // Java 26.3 destroys a Straw Bed when use is attempted in Nether/End.
      this.sound.playBlockBreak(35);
    }
    this.notifyState();
  }

`;
insertBefore('src/engine/Game.ts', '  private useBed(x: number, y: number, z: number) {', strawMethod);

// 307-310: 20 executable parity rounds around names, icons, placement and use contracts.
write('tests/parity-291-310.test.ts', `import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { VisualResolver } from '../src/visual/VisualResolver';
import { resolveItemPresentationIdentity, getItemTranslationKey } from '../src/items/ItemPresentation';
import { planBlockPlacement } from '../src/world/BlockPlacement';
import { BehaviorRegistry } from '../src/world/BehaviorRegistry';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';
import {
  CUSHION_ITEMS,
  WILDERNESS_BOUND_ITEMS,
  useStrawBed,
} from '../src/world/WildernessBound26_3';
import { CushionSeatSystem26_3 } from '../src/world/WildernessBoundGameplay26_3';

registerWildernessBound26_3();

const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};
const target = (blockId: number, face: 'up' | 'north' = 'up') => ({
  position: { x: 10, y: 64, z: 10 },
  face,
  blockId,
  block: BlockRegistry.get(blockId)!,
  heldItem: null,
});
const world = {
  getBlock: ({ y }: { x: number; y: number; z: number }) => y <= 64 ? 1 : 0,
  getBlockMetadata: () => undefined,
};

test('291: modern Poplar block items resolve presentation as blocks', () => {
  const id = item('poplar_log').id;
  const identity = resolveItemPresentationIdentity(id);
  assert.equal(identity.kind, 'block');
  assert.equal(identity.registryName, 'poplar_log');
});

test('292: Straw Bed uses a block translation key despite its modern runtime ID', () => {
  assert.equal(getItemTranslationKey(item('straw_bed').id), 'block_straw_bed');
});

test('293: Cushion remains an item presentation instead of being range-classified as a block', () => {
  const identity = resolveItemPresentationIdentity(item('red_cushion').id);
  assert.equal(identity.kind, 'item');
  assert.equal(identity.registryName, 'red_cushion');
});

test('294: Poplar block item icon resolves through the block icon pipeline', () => {
  assert.match(VisualResolver.getItemIconKey(item('poplar_log').id), /^icon:block:/);
});

test('295: Cushion has an item sprite key', () => {
  assert.equal(VisualResolver.getItemIconKey(item('red_cushion').id), 'item:red_cushion');
});

test('296: 26.3 explorer maps reuse the filled-map inventory icon', () => {
  assert.equal(VisualResolver.getItemIconKey(item('ocean_monument_map').id), 'item:filled_map');
});

test('297: Straw Bed item dispatches through block_item so it can be placed', () => {
  assert.equal(item('straw_bed').behaviorId, 'minecraft:block_item');
});

test('298: every 26.3 direct block item uses the generic block placement behavior', () => {
  for (const def of WILDERNESS_BOUND_ITEMS) {
    assert.equal(ItemRegistry.get(def.id)?.behaviorId, 'minecraft:block_item', def.name);
  }
});

test('299: Straw Bed resolves its exact modern placeBlockId', () => {
  const def = item('straw_bed');
  assert.equal(ItemRegistry.getPlaceBlockId(def.id), def.id);
});

test('300: Cushions are not misclassified as block-placeable items', () => {
  assert.equal(ItemRegistry.getPlaceBlockId(item('red_cushion').id), undefined);
});

test('301: modern Straw Bed placement plans as a bed', () => {
  const def = item('straw_bed');
  const decision = planBlockPlacement({ item: def, target: target(1), placeBlockId: def.placeBlockId, playerOccupiedCells: [] }, world);
  assert.equal(decision.ok, true);
  if (decision.ok) assert.equal(decision.plan.kind, 'bed');
});

test('302: modern Poplar Planks placement plans as a simple block', () => {
  const def = item('poplar_planks');
  const decision = planBlockPlacement({ item: def, target: target(1), placeBlockId: def.placeBlockId, playerOccupiedCells: [] }, world);
  assert.equal(decision.ok, true);
  if (decision.ok) assert.equal(decision.plan.kind, 'simple');
});

test('303: 26.3 wool slabs enter slab placement semantics', () => {
  const def = item('red_wool_slab');
  const decision = planBlockPlacement({ item: def, target: target(1), placeBlockId: def.placeBlockId, playerOccupiedCells: [] }, world);
  assert.equal(decision.ok, true);
  if (decision.ok) assert.equal(decision.plan.kind, 'slab');
});

test('304: high runtime IDs do not become legacy support-restricted blocks by low-bit collision', () => {
  BlockRegistry.registerDataPackBlocks([{ id: 60019, name: 'runtime_test_block', textureKey: 'stone', baseId: 60019 }]);
  ItemRegistry.registerDataPackItems([{ id: 60019, name: 'runtime_test_block', displayName: 'Runtime Test Block', category: 'block', placeBlockId: 60019 }]);
  const def = item('runtime_test_block');
  const decision = planBlockPlacement({ item: def, target: target(1), placeBlockId: 60019, playerOccupiedCells: [] }, world);
  assert.equal(decision.ok, true);
});

test('305: Straw Bed sleeps in the Overworld without setting spawn and is consumed', () => {
  const result = useStrawBed('overworld');
  assert.deepEqual(result, { canSleep: true, setsSpawn: false, destroyAfterUse: true });
});

test('306: Straw Bed is destroyed but cannot sleep in the Nether', () => {
  const result = useStrawBed('nether');
  assert.equal(result.canSleep, false);
  assert.equal(result.destroyAfterUse, true);
  assert.equal(result.setsSpawn, false);
});

test('307: Cushion placement accepts a supported flat top surface', () => {
  const seats = new CushionSeatSystem26_3();
  const placed = seats.place({ hitX: 3.2, hitZ: 4.8, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'blue' }, '3,64,4');
  assert.ok(placed);
  assert.deepEqual({ x: placed.x, y: placed.y, z: placed.z }, { x: 3.5, y: 65, z: 4.5 });
});

test('308: Cushion placement rejects non-flat or unsupported surfaces', () => {
  const seats = new CushionSeatSystem26_3();
  assert.equal(seats.place({ hitX: 0, hitZ: 0, supportTopY: 1, flatSurface: false, supportingBlock: true, color: 'red' }, 'x'), null);
  assert.equal(seats.place({ hitX: 0, hitZ: 0, supportTopY: 1, flatSurface: true, supportingBlock: false, color: 'red' }, 'x'), null);
});

test('309: Cushion placement rejects a second Cushion at the same position', () => {
  const seats = new CushionSeatSystem26_3();
  const request = { hitX: 1.2, hitZ: 2.2, supportTopY: 70, flatSurface: true, supportingBlock: true, color: 'white' as const };
  assert.ok(seats.place(request, 'support'));
  assert.equal(seats.place(request, 'support'), null);
});

test('310: behavior registry dispatches modern Straw Bed block items through block_item', () => {
  const behaviors = new BehaviorRegistry<any, any, any>();
  behaviors.registerItem('block_item', { id: 'minecraft:block_item', use: () => ({ handled: true, cooldown: 0.25 }) });
  const def = item('straw_bed');
  const result = behaviors.useItem({ item: def, stack: { id: def.id, count: 1 } });
  assert.equal(result?.handled, true);
});

assert.equal(CUSHION_ITEMS.length, 16);
`);

console.log('Applied parity 291-310 item fundamentals patch.');
