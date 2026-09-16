import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

function replaceText(path, before, after, label) {
  const source = read(path);
  if (!source.includes(before)) throw new Error(`${label}: anchor missing in ${path}`);
  write(path, source.replace(before, after));
}

function replaceRegex(path, regex, after, label) {
  const source = read(path);
  if (!regex.test(source)) throw new Error(`${label}: regex anchor missing in ${path}`);
  write(path, source.replace(regex, after));
}

function insertBefore(path, marker, content, label) {
  const source = read(path);
  if (!source.includes(marker)) throw new Error(`${label}: marker missing in ${path}`);
  write(path, source.replace(marker, `${content}${marker}`));
}

write('src/items/ItemPresentation.ts', `import { ItemRegistry, type ItemDef } from './ItemRegistry';
import { BlockRegistry } from '../world/BlockRegistry';
import type { BlockDef } from '../types';

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

/** Resolve display/icon identity without relying on legacy numeric ID ranges. */
export function resolveItemPresentationIdentity(itemId: number, fallbackName?: string): ItemPresentationIdentity {
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

replaceText(
  'src/i18n.tsx',
  "import { localizeItemDisplayName } from './i18nItemNames';",
  "import { localizeItemDisplayName } from './i18nItemNames';\nimport { resolveItemPresentationIdentity } from './items/ItemPresentation';",
  'presentation import',
);

replaceRegex(
  'src/i18n.tsx',
  /  const getLocalizedItemName = \(id: number, fallbackName\?: string\): string => \{[\s\S]*?\n  \};\n\n  const getLocalizedDisplayName/,
  `  const getLocalizedItemName = (id: number, fallbackName?: string): string => {
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
  };

  const getLocalizedDisplayName`,
  'localized item resolver',
);

replaceRegex(
  'src/visual/VisualResolver.ts',
  /    const item = ItemRegistry\.get\(itemId\);\n    if \(!item\) return 'item:unknown';\n    return `item:\$\{item\.name\}`;/,
  `    const item = ItemRegistry.get(itemId);
    if (!item) return 'item:unknown';
    if (item.behaviorId === 'minecraft:readable' && item.name.endsWith('_map')) {
      return 'item:filled_map';
    }
    return \`item:${'${item.name}'}\`;`,
  'explorer map icon',
);

replaceText(
  'src/world/WildernessBound26_3.ts',
  "    behaviorId: block.name === 'straw_bed' ? 'minecraft:straw_bed' : undefined,",
  "    behaviorId: 'minecraft:block_item',",
  'block item behavior',
);

replaceRegex(
  'src/world/BlockPlacement.ts',
  /  const baseId = blockId & 0x3FF;\n  const blockBelow = world\.getBlock\(\{ x: position\.x, y: position\.y - 1, z: position\.z \}\) & 0x3FF;[\s\S]*?  const isDoor = isDoorName\(request\.item\.name\) \|\| isDoorName\(blockName\);\n  const isBed = baseId === 26 \|\| blockName === 'bed' \|\| blockName\.endsWith\('_bed'\);/,
  `  // Legacy packed block IDs must not leak into modern high runtime IDs.
  const registeredBaseId = block?.baseId ?? blockId;
  const legacyBaseId = registeredBaseId < 256 ? registeredBaseId & 0x3FF : undefined;
  const blockBelowId = world.getBlock({ x: position.x, y: position.y - 1, z: position.z });
  const blockBelow = BlockRegistry.get(blockBelowId);
  const registeredBelowBaseId = blockBelow?.baseId ?? blockBelowId;
  const legacyBelowBaseId = registeredBelowBaseId < 256 ? registeredBelowBaseId & 0x3FF : undefined;
  if ((legacyBaseId === 115 || blockName === 'nether_wart') && legacyBelowBaseId !== 88 && blockBelow?.name !== 'soul_sand') {
    return { ok: false, reason: 'invalid_support' };
  }
  if (
    (legacyBaseId === 59 || legacyBaseId === 141 || legacyBaseId === 142 || ['wheat', 'carrots', 'potatoes'].includes(blockName))
    && legacyBelowBaseId !== 60
    && blockBelow?.name !== 'farmland'
  ) {
    return { ok: false, reason: 'invalid_support' };
  }

  const isDoor = isDoorName(request.item.name) || isDoorName(blockName);
  const isBed = legacyBaseId === 26 || blockName === 'bed' || blockName.endsWith('_bed');`,
  'modern block placement IDs',
);

replaceText(
  'src/engine/Game.ts',
  "import { fallingLeafParticle26_3, shouldPrioritizeShieldUse26_3 } from '../world/WildernessBoundChanges26_3';",
  "import { fallingLeafParticle26_3, shouldPrioritizeShieldUse26_3 } from '../world/WildernessBoundChanges26_3';\nimport { useStrawBed as resolveStrawBedUse26_3 } from '../world/WildernessBound26_3';",
  'straw bed import',
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
replaceText(
  'src/engine/Game.ts',
  bedBehavior,
  `${bedBehavior}    this.behaviors.registerBlock([], {
      id: 'minecraft:straw_bed',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.useStrawBed26_3(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.25 };
      },
    });
`,
  'straw bed behavior',
);

insertBefore(
  'src/engine/Game.ts',
  '  private useBed(x: number, y: number, z: number) {',
  `  private useStrawBed26_3(x: number, y: number, z: number) {
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
      if (this.gameTime >= 0.5) this.gameTime = 0.05;
      this.advancements.checkSleep();
      this.sound.playBlockPlace(35);
    } else {
      this.sound.playBlockBreak(35);
    }
    this.notifyState();
  }

`,
  'straw bed runtime',
);

write('tests/parity-291-310.test.ts', `import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { VisualResolver } from '../src/visual/VisualResolver';
import { resolveItemPresentationIdentity, getItemTranslationKey } from '../src/items/ItemPresentation';
import { planBlockPlacement } from '../src/world/BlockPlacement';
import { BehaviorRegistry } from '../src/world/BehaviorRegistry';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';
import { CUSHION_ITEMS, WILDERNESS_BOUND_ITEMS, useStrawBed } from '../src/world/WildernessBound26_3';
import { CushionSeatSystem26_3 } from '../src/world/WildernessBoundGameplay26_3';

registerWildernessBound26_3();
const item = (name: string) => { const def = ItemRegistry.getByName(name); assert.ok(def, name); return def; };
const target = (blockId: number, face: 'up' | 'north' = 'up') => ({ position: { x: 10, y: 64, z: 10 }, face, blockId, block: BlockRegistry.get(blockId)!, heldItem: null });
const world = {
  getBlock: ({ y }: { x: number; y: number; z: number }) => y <= 64 ? 1 : 0,
  getBlockMetadata: () => undefined,
};

test('291: modern Poplar block items resolve presentation as blocks', () => {
  const identity = resolveItemPresentationIdentity(item('poplar_log').id);
  assert.equal(identity.kind, 'block'); assert.equal(identity.registryName, 'poplar_log');
});
test('292: Straw Bed uses a block translation key despite modern runtime ID', () => assert.equal(getItemTranslationKey(item('straw_bed').id), 'block_straw_bed'));
test('293: Cushion remains an item presentation', () => assert.equal(resolveItemPresentationIdentity(item('red_cushion').id).kind, 'item'));
test('294: Poplar block item icon uses block icon pipeline', () => assert.match(VisualResolver.getItemIconKey(item('poplar_log').id), /^icon:block:/));
test('295: Cushion has item sprite key', () => assert.equal(VisualResolver.getItemIconKey(item('red_cushion').id), 'item:red_cushion'));
test('296: explorer maps reuse filled-map icon', () => assert.equal(VisualResolver.getItemIconKey(item('ocean_monument_map').id), 'item:filled_map'));
test('297: Straw Bed dispatches through block_item placement', () => assert.equal(item('straw_bed').behaviorId, 'minecraft:block_item'));
test('298: every 26.3 direct block item uses generic placement', () => { for (const def of WILDERNESS_BOUND_ITEMS) assert.equal(ItemRegistry.get(def.id)?.behaviorId, 'minecraft:block_item', def.name); });
test('299: Straw Bed resolves exact modern placeBlockId', () => { const def = item('straw_bed'); assert.equal(ItemRegistry.getPlaceBlockId(def.id), def.id); });
test('300: Cushions are not block-placeable', () => assert.equal(ItemRegistry.getPlaceBlockId(item('red_cushion').id), undefined));
test('301: Straw Bed placement plans as bed', () => { const def = item('straw_bed'); const d = planBlockPlacement({ item: def, target: target(1), placeBlockId: def.placeBlockId, playerOccupiedCells: [] }, world); assert.equal(d.ok, true); if (d.ok) assert.equal(d.plan.kind, 'bed'); });
test('302: Poplar Planks placement plans as simple block', () => { const def = item('poplar_planks'); const d = planBlockPlacement({ item: def, target: target(1), placeBlockId: def.placeBlockId, playerOccupiedCells: [] }, world); assert.equal(d.ok, true); if (d.ok) assert.equal(d.plan.kind, 'simple'); });
test('303: wool slabs enter slab placement semantics', () => { const def = item('red_wool_slab'); const d = planBlockPlacement({ item: def, target: target(1), placeBlockId: def.placeBlockId, playerOccupiedCells: [] }, world); assert.equal(d.ok, true); if (d.ok) assert.equal(d.plan.kind, 'slab'); });
test('304: high runtime IDs avoid legacy low-bit support collisions', () => { BlockRegistry.registerDataPackBlocks([{ id: 60019, name: 'runtime_test_block', textureKey: 'stone', baseId: 60019 }]); ItemRegistry.registerDataPackItems([{ id: 60019, name: 'runtime_test_block', displayName: 'Runtime Test Block', category: 'block', placeBlockId: 60019 }]); const def = item('runtime_test_block'); const d = planBlockPlacement({ item: def, target: target(1), placeBlockId: 60019, playerOccupiedCells: [] }, world); assert.equal(d.ok, true); });
test('305: Straw Bed sleeps in Overworld without setting spawn', () => assert.deepEqual(useStrawBed('overworld'), { canSleep: true, setsSpawn: false, destroyAfterUse: true }));
test('306: Straw Bed is destroyed but cannot sleep in Nether', () => { const r = useStrawBed('nether'); assert.equal(r.canSleep, false); assert.equal(r.destroyAfterUse, true); assert.equal(r.setsSpawn, false); });
test('307: Cushion placement accepts supported flat top', () => { const seats = new CushionSeatSystem26_3(); assert.ok(seats.place({ hitX: 3.2, hitZ: 4.8, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'blue' }, '3,64,4')); });
test('308: Cushion placement rejects unsupported surfaces', () => { const seats = new CushionSeatSystem26_3(); assert.equal(seats.place({ hitX: 0, hitZ: 0, supportTopY: 1, flatSurface: false, supportingBlock: true, color: 'red' }, 'x'), null); });
test('309: Cushion rejects duplicate placement position', () => { const seats = new CushionSeatSystem26_3(); const req = { hitX: 1.2, hitZ: 2.2, supportTopY: 70, flatSurface: true, supportingBlock: true, color: 'white' as const }; assert.ok(seats.place(req, 'support')); assert.equal(seats.place(req, 'support'), null); });
test('310: behavior registry dispatches Straw Bed through block_item', () => { const behaviors = new BehaviorRegistry(); behaviors.registerItem('block_item', { id: 'minecraft:block_item', use: () => ({ handled: true }) }); const def = item('straw_bed'); assert.equal(behaviors.useItem({ item: def, stack: { id: def.id, count: 1 } })?.handled, true); });

assert.equal(CUSHION_ITEMS.length, 16);
`);

console.log('Applied parity 291-310 item fundamentals patch v2.');
