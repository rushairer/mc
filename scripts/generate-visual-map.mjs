import fs from 'node:fs';
import path from 'node:path';

const blocks = JSON.parse(fs.readFileSync('src/items/data/blocks.json', 'utf8'));
const items = JSON.parse(fs.readFileSync('src/items/data/items.json', 'utf8'));

const outPath = 'src/items/data/visual-map.json';

const pack = (baseId, metadata = 0) => (metadata << 10) | baseId;
const normalize = (name) => name.toLowerCase().replace(/^minecraft:/, '').replace(/\s+/g, '_');
const baseId = (id) => id & 0x3FF;
const metadata = (id) => id >> 10;
const runtimeId = (item) => typeof item.id === 'number' ? item.id : item.runtimeId;
const officialId = (item) => typeof item.id === 'string' ? item.id : (item.officialId ?? `minecraft:${item.name}`);
const blockRuntimeId = (block) => typeof block.id === 'number' ? block.id : block.runtimeId;
const blockOfficialId = (block) => typeof block.id === 'string' ? block.id : (block.officialId ?? `minecraft:${block.name}`);

const placeOverrides = new Map([
  [295, 59],
  [323, 63],
  [324, 64],
  [330, 71],
  [331, 55],
  [338, 83],
  [354, 92],
  [355, 26],
  [356, 93],
  [361, 104],
  [362, 105],
  [372, 115],
  [379, 117],
  [380, 118],
  [390, 140],
  [391, 141],
  [392, 142],
  [397, 144],
  [1421, pack(144, 1)],
  [2445, pack(144, 2)],
  [3469, pack(144, 3)],
  [4493, pack(144, 4)],
  [404, 149],
  [427, 193],
  [428, 194],
  [429, 195],
  [430, 196],
  [431, 197],
  [435, 207],
]);

const woodMaterials = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'];

function woodFromName(name) {
  const normalized = normalize(name);
  if (normalized.includes('dark_oak')) return 'dark_oak';
  return woodMaterials.find((material) => normalized.includes(material)) ?? null;
}

function woodFromLog(id, name) {
  const b = baseId(id);
  const meta = metadata(id);
  if (b === 162) return (meta & 0x3) === 1 ? 'dark_oak' : 'acacia';
  return woodFromName(name) ?? (['oak', 'spruce', 'birch', 'jungle'][meta & 0x3] ?? 'oak');
}

function blockFaceTexture(id, name, face) {
  const b = baseId(id);
  if (b === 2 || name === 'grass') {
    if (face === 'top') return 'block:grass_top';
    if (face === 'bottom') return 'block:dirt';
    return 'block:grass_side';
  }
  if (b === 8 || b === 9 || name.includes('water')) return 'block:water';
  if (b === 10 || b === 11 || name.includes('lava')) return 'block:lava';
  if (name.includes('planks')) return `block:${woodFromName(name) ?? 'oak'}_planks`;
  if (name.includes('leaves')) return `block:${woodFromName(name) ?? 'oak'}_leaves`;
  if (b === 17 || b === 162 || name.includes('log') || (name.includes('wood') && !name.includes('planks'))) {
    const material = woodFromLog(id, name);
    const axis = metadata(id) & 0xC;
    const end = `block:${material}_log_top`;
    const side = `block:${material}_log_side`;
    if (axis === 4) return face === 'right' || face === 'left' ? end : side;
    if (axis === 8) return face === 'front' || face === 'back' ? end : side;
    return face === 'top' || face === 'bottom' ? end : side;
  }
  return `block:${name}`;
}

function blockIconKey(id, name) {
  const b = baseId(id);
  if (b === 2 || name === 'grass') return 'icon:block:grass';
  if (name.includes('planks')) return `icon:block:${woodFromName(name) ?? 'oak'}_planks`;
  if (name.includes('leaves')) return `icon:block:${woodFromName(name) ?? 'oak'}_leaves`;
  if (b === 17 || b === 162 || name.includes('log') || (name.includes('wood') && !name.includes('planks'))) return `icon:block:${woodFromLog(id, name)}_log`;
  return `icon:block:${name}`;
}

const blockStates = [];
const blockById = new Map();
for (const block of blocks) {
  const blockId = blockRuntimeId(block);
  if (typeof blockId !== 'number') throw new Error(`Block ${block.id} is missing runtimeId`);
  const official = blockOfficialId(block);
  const baseRecord = {
    id: blockId,
    baseId: blockId,
    metadata: 0,
    name: normalize(block.name),
    displayName: block.displayName,
    officialId: official,
  };
  blockStates.push(baseRecord);
  blockById.set(baseRecord.id, baseRecord);

  for (const variation of block.variations ?? []) {
    const record = {
      id: pack(blockId, variation.metadata),
      baseId: blockId,
      metadata: variation.metadata,
      name: normalize(variation.displayName),
      displayName: variation.displayName,
      officialId: `${official}#${variation.metadata}`,
    };
    blockStates.push(record);
    blockById.set(record.id, record);
  }
}

const expandedItems = [];
for (const item of items) {
  const itemRuntimeId = runtimeId(item);
  if (typeof itemRuntimeId !== 'number') throw new Error(`Item ${item.id} is missing runtimeId`);
  const itemOfficialId = officialId(item);

  if (item.variations?.length) {
    for (const variation of item.variations) {
      expandedItems.push({
        id: pack(itemRuntimeId, variation.metadata),
        baseId: itemRuntimeId,
        metadata: variation.metadata,
        name: normalize(variation.displayName),
        displayName: variation.displayName,
        officialId: `${itemOfficialId}#${variation.metadata}`,
      });
    }
  } else {
    expandedItems.push({
      id: itemRuntimeId,
      baseId: itemRuntimeId,
      metadata: 0,
      name: normalize(item.name),
      displayName: item.displayName,
      officialId: itemOfficialId,
    });
  }
}

const faceNames = ['top', 'bottom', 'right', 'left', 'front', 'back'];
const blockVisuals = {};
for (const block of blockStates) {
  blockVisuals[block.id] = {
    name: block.name,
    displayName: block.displayName,
    source: 'generated',
    icon: blockIconKey(block.id, block.name),
    faces: Object.fromEntries(faceNames.map((face) => [face, blockFaceTexture(block.id, block.name, face)])),
  };
}

const itemVisuals = {};
for (const item of expandedItems) {
  const directBlock = blockById.get(item.id);
  const placeBlockId = placeOverrides.get(item.id) ?? (directBlock ? item.id : undefined);
  const placedBlock = placeBlockId === undefined ? undefined : blockById.get(placeBlockId);
  itemVisuals[item.id] = {
    name: item.name,
    officialId: item.officialId,
    displayName: item.displayName,
    source: 'generated',
    kind: placeBlockId !== undefined ? 'block' : item.name.includes('sword') || item.name.includes('pickaxe') || item.name.includes('shovel') || item.name.includes('axe') ? 'tool' : 'sprite',
    placeBlockId,
    icon: placedBlock ? blockIconKey(placeBlockId, placedBlock.name) : `item:${item.name}`,
  };
}

const manifest = {
  schemaVersion: 1,
  generator: 'scripts/generate-visual-map.mjs',
  assetRoots: {
    blockTextures: 'public/mc-assets/textures/block',
    itemTextures: 'public/mc-assets/textures/item',
    blockModels: 'public/mc-assets/models/block',
    itemModels: 'public/mc-assets/models/item',
  },
  counts: {
    items: expandedItems.length,
    blockStates: blockStates.length,
  },
  blockStates: blockVisuals,
  items: itemVisuals,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
