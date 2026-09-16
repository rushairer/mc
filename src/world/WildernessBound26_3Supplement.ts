import type { DataPackBlock, DataPackItem } from '../systems/DataPackTypes';

const POPLAR_SHELF_ID = 54200;
const POPLAR_BOAT_ID = 54300;
const POPLAR_CHEST_BOAT_ID = 54301;

export const POPLAR_SHELF_BLOCK: DataPackBlock = {
  id: POPLAR_SHELF_ID,
  officialId: 'minecraft:poplar_shelf',
  name: 'poplar_shelf',
  displayName: 'Poplar Shelf',
  textureKey: 'poplar_shelf',
  transparent: true,
  solid: true,
  hardness: 2,
  luminance: 0,
  toolCategory: 'axe',
};

export const WILDERNESS_BOUND_SUPPLEMENT_BLOCKS: DataPackBlock[] = [POPLAR_SHELF_BLOCK];

export const WILDERNESS_BOUND_SUPPLEMENT_ITEMS: DataPackItem[] = [
  {
    id: POPLAR_SHELF_ID,
    officialId: 'minecraft:poplar_shelf',
    baseId: POPLAR_SHELF_ID,
    name: 'poplar_shelf',
    displayName: 'Poplar Shelf',
    maxStackSize: 64,
    category: 'block',
    placeBlockId: POPLAR_SHELF_ID,
    behaviorId: 'minecraft:block_item',
  },
  {
    id: POPLAR_BOAT_ID,
    officialId: 'minecraft:poplar_boat',
    baseId: POPLAR_BOAT_ID,
    name: 'poplar_boat',
    displayName: 'Poplar Boat',
    maxStackSize: 1,
    category: 'material',
    behaviorId: 'minecraft:boat',
  },
  {
    id: POPLAR_CHEST_BOAT_ID,
    officialId: 'minecraft:poplar_chest_boat',
    baseId: POPLAR_CHEST_BOAT_ID,
    name: 'poplar_chest_boat',
    displayName: 'Poplar Chest Boat',
    maxStackSize: 1,
    category: 'material',
    behaviorId: 'minecraft:boat',
  },
];
