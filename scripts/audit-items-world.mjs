import fs from 'node:fs';

const items = JSON.parse(fs.readFileSync('src/items/data/items.json', 'utf8'));
const blocks = JSON.parse(fs.readFileSync('src/items/data/blocks.json', 'utf8'));
const visualMap = JSON.parse(fs.readFileSync('src/items/data/visual-map.json', 'utf8'));

const normalize = (name) => name.toLowerCase().replace(/ /g, '_').replace(/^minecraft:/, '');
const pack = (baseId, metadata = 0) => (metadata << 10) | baseId;

const expandedItems = [];
for (const item of items) {
  if (item.variations?.length) {
    for (const variation of item.variations) {
      expandedItems.push({
        id: pack(item.id, variation.metadata),
        baseId: item.id,
        metadata: variation.metadata,
        name: normalize(variation.displayName),
        displayName: variation.displayName,
      });
    }
  } else {
    expandedItems.push({
      id: item.id,
      baseId: item.id,
      metadata: 0,
      name: normalize(item.name),
      displayName: item.displayName,
    });
  }
}

const expandedBlocks = [];
const blockByName = new Map();
for (const block of blocks) {
  const baseRecord = {
    id: block.id,
    baseId: block.id,
    metadata: 0,
    name: normalize(block.name),
    displayName: block.displayName,
    stackSize: block.stackSize ?? 64,
    boundingBox: block.boundingBox,
  };
  expandedBlocks.push(baseRecord);
  blockByName.set(baseRecord.name, baseRecord);

  for (const variation of block.variations ?? []) {
    const record = {
      id: pack(block.id, variation.metadata),
      baseId: block.id,
      metadata: variation.metadata,
      name: normalize(variation.displayName),
      displayName: variation.displayName,
      stackSize: block.stackSize ?? 64,
      boundingBox: block.boundingBox,
    };
    expandedBlocks.push(record);
    if (!blockByName.has(record.name)) {
      blockByName.set(record.name, record);
    }
  }
}

const itemById = new Map(expandedItems.map((item) => [item.id, item]));
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

const placeableItems = expandedItems
  .map((item) => ({
    item,
    blockId: placeOverrides.get(item.id) ?? (item.baseId > 0 && item.baseId < 256 ? item.id : undefined),
  }))
  .filter((entry) => entry.blockId !== undefined);

const missingPlaceBlocks = placeableItems.filter((entry) => !expandedBlocks.some((block) => block.id === entry.blockId));
const implicitNameMatches = expandedItems
  .filter((item) => item.baseId >= 256 && !placeOverrides.has(item.id))
  .map((item) => ({ item, block: blockByName.get(item.name) }))
  .filter((entry) => entry.block);

const missingItemVisuals = expandedItems.filter((item) => !visualMap.items[String(item.id)]?.icon);
const missingBlockVisuals = expandedBlocks.filter((block) => {
  const visual = visualMap.blockStates[String(block.id)];
  return !visual?.icon || !visual.faces?.top || !visual.faces?.bottom || !visual.faces?.front || !visual.faces?.back || !visual.faces?.left || !visual.faces?.right;
});

const sourceCounts = { real: 0, generated: 0, fallback: 0, unknown: 0 };
for (const visual of [...Object.values(visualMap.items), ...Object.values(visualMap.blockStates)]) {
  const source = visual?.source;
  if (source === 'real' || source === 'generated' || source === 'fallback') sourceCounts[source]++;
  else sourceCounts.unknown++;
}

const criticalChecks = [
  ['grass block top', visualMap.blockStates['2']?.faces?.top === 'block:grass_top'],
  ['grass block side', visualMap.blockStates['2']?.faces?.front === 'block:grass_side'],
  ['grass item icon', visualMap.items['2']?.icon === 'icon:block:grass'],
  ['water texture', visualMap.blockStates['9']?.faces?.top === 'block:water'],
  ['flowing water texture', visualMap.blockStates['8']?.faces?.top === 'block:water'],
  ['oak log icon', visualMap.items['17']?.icon === 'icon:block:oak_log'],
  ['oak log top', visualMap.blockStates['17']?.faces?.top === 'block:oak_log_top'],
  ['oak log side', visualMap.blockStates['17']?.faces?.front === 'block:oak_log_side'],
];

console.log(`Items expanded: ${expandedItems.length}`);
console.log(`Block states expanded: ${expandedBlocks.length}`);
console.log(`Placeable item mappings: ${placeableItems.length}`);
console.log(`Visual item coverage: ${expandedItems.length - missingItemVisuals.length}/${expandedItems.length}`);
console.log(`Visual block-state coverage: ${expandedBlocks.length - missingBlockVisuals.length}/${expandedBlocks.length}`);
console.log(`Visual sources: real=${sourceCounts.real}, generated=${sourceCounts.generated}, fallback=${sourceCounts.fallback}, unknown=${sourceCounts.unknown}`);

if (missingPlaceBlocks.length) {
  console.log('\nMissing mapped block definitions:');
  for (const entry of missingPlaceBlocks) {
    console.log(`- ${entry.item.id} ${entry.item.displayName} -> ${entry.blockId}`);
  }
}

if (implicitNameMatches.length) {
  console.log('\nNon-block items whose names match block states but are not mapped:');
  for (const { item, block } of implicitNameMatches) {
    console.log(`- ${item.id} ${item.displayName} could place ${block.id} ${block.displayName}`);
  }
}

if (missingItemVisuals.length) {
  console.log('\nMissing item visuals:');
  for (const item of missingItemVisuals.slice(0, 80)) {
    console.log(`- ${item.id} ${item.displayName} (${item.name})`);
  }
}

if (missingBlockVisuals.length) {
  console.log('\nMissing block-state visuals:');
  for (const block of missingBlockVisuals.slice(0, 80)) {
    console.log(`- ${block.id} ${block.displayName} (${block.name})`);
  }
}

const failedCriticalChecks = criticalChecks.filter(([, passed]) => !passed);
if (failedCriticalChecks.length) {
  console.log('\nFailed critical visual checks:');
  for (const [name] of failedCriticalChecks) console.log(`- ${name}`);
}

if (missingPlaceBlocks.length || missingItemVisuals.length || missingBlockVisuals.length || failedCriticalChecks.length || sourceCounts.fallback > 0 || sourceCounts.unknown > 0) {
  process.exitCode = 1;
}
