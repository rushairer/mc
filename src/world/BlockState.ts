import type {
  BlockDef,
  BlockMetadata,
  BlockState,
  BlockStateProperties,
  BlockStatePropertySchema,
  BlockStateSchema,
  BlockStateValue,
} from '../types';

const booleanProperty = (defaultValue = false): BlockStatePropertySchema => ({
  values: [false, true],
  defaultValue,
});

const enumProperty = <T extends BlockStateValue>(values: readonly T[], defaultValue: T): BlockStatePropertySchema => ({
  values,
  defaultValue,
});

const numberProperty = (min: number, max: number, defaultValue = min): BlockStatePropertySchema => ({
  values: Array.from({ length: max - min + 1 }, (_, index) => min + index),
  defaultValue,
});

const horizontalFacing = enumProperty(['north', 'east', 'south', 'west'], 'north');
const allFacing = enumProperty(['north', 'east', 'south', 'west', 'up', 'down'], 'north');

/** Derives the minimum useful 1.20.1-style property schema for a block family. */
export function createBlockStateSchema(name: string): BlockStateSchema | undefined {
  const normalized = name.toLowerCase();
  const properties: Record<string, BlockStatePropertySchema> = {};

  if (normalized.includes('stairs')) {
    Object.assign(properties, {
      facing: horizontalFacing,
      half: enumProperty(['bottom', 'top'], 'bottom'),
      shape: enumProperty(['straight', 'inner_left', 'inner_right', 'outer_left', 'outer_right'], 'straight'),
      waterlogged: booleanProperty(),
    });
  } else if (normalized.includes('slab')) {
    Object.assign(properties, {
      type: enumProperty(['bottom', 'top', 'double'], 'bottom'),
      waterlogged: booleanProperty(),
    });
  } else if (normalized.includes('trapdoor')) {
    Object.assign(properties, {
      facing: horizontalFacing,
      half: enumProperty(['bottom', 'top'], 'bottom'),
      open: booleanProperty(),
      powered: booleanProperty(),
      waterlogged: booleanProperty(),
    });
  } else if (normalized.includes('door')) {
    Object.assign(properties, {
      facing: horizontalFacing,
      half: enumProperty(['lower', 'upper'], 'lower'),
      hinge: enumProperty(['left', 'right'], 'left'),
      open: booleanProperty(),
      powered: booleanProperty(),
    });
  } else if (
    normalized.includes('fence')
    || normalized.endsWith('_wall')
    || normalized.includes('pane')
    || normalized.includes('bars')
  ) {
    Object.assign(properties, {
      north: booleanProperty(),
      east: booleanProperty(),
      south: booleanProperty(),
      west: booleanProperty(),
      waterlogged: booleanProperty(),
    });
  } else if (
    normalized.includes('log')
    || normalized.endsWith('_wood')
    || normalized.includes('stem')
    || normalized.includes('hyphae')
    || normalized.includes('pillar')
  ) {
    properties.axis = enumProperty(['x', 'y', 'z'], 'y');
  }

  if (/^(wheat|carrots|potatoes|beetroots|nether_wart|sweet_berry_bush|cocoa)$/.test(normalized)) {
    properties.age = numberProperty(0, normalized === 'beetroots' || normalized === 'nether_wart' ? 3 : 7);
  }
  if (normalized.includes('button') || normalized.includes('lever')) {
    properties.face = enumProperty(['floor', 'wall', 'ceiling'], 'wall');
    properties.facing = horizontalFacing;
    properties.powered = booleanProperty();
  }
  if (normalized.includes('redstone_wire')) {
    properties.power = numberProperty(0, 15);
    for (const direction of ['north', 'east', 'south', 'west']) {
      properties[direction] = enumProperty(['none', 'side', 'up'], 'none');
    }
  }
  if (normalized.includes('repeater')) {
    properties.facing = horizontalFacing;
    properties.delay = numberProperty(1, 4, 1);
    properties.locked = booleanProperty();
    properties.powered = booleanProperty(normalized.includes('powered'));
  }
  if (normalized.includes('comparator')) {
    properties.facing = horizontalFacing;
    properties.mode = enumProperty(['compare', 'subtract'], 'compare');
    properties.powered = booleanProperty(normalized.includes('powered'));
  }
  if (normalized.includes('observer')) {
    properties.facing = allFacing;
    properties.powered = booleanProperty();
  }
  if (normalized.includes('piston')) {
    properties.facing = allFacing;
    properties.extended = booleanProperty();
  }
  if (normalized === 'water' || normalized === 'flowing_water' || normalized === 'lava' || normalized === 'flowing_lava') {
    properties.level = numberProperty(0, 15);
  }
  if (normalized.includes('sign')) {
    if (normalized.includes('wall')) properties.facing = horizontalFacing;
    else properties.rotation = numberProperty(0, 15);
    properties.waterlogged = booleanProperty();
  }

  return Object.keys(properties).length > 0 ? { properties } : undefined;
}

export function getDefaultBlockState(schema?: BlockStateSchema): BlockStateProperties {
  if (!schema) return {};
  return Object.fromEntries(
    Object.entries(schema.properties).map(([name, property]) => [name, property.defaultValue]),
  );
}

export function normalizeBlockStateProperties(
  schema: BlockStateSchema | undefined,
  input: BlockStateProperties | undefined,
): BlockStateProperties {
  const normalized = getDefaultBlockState(schema);
  if (!schema || !input) return normalized;

  for (const [name, value] of Object.entries(input)) {
    const property = schema.properties[name];
    if (property?.values.includes(value)) normalized[name] = value;
  }
  return normalized;
}

function legacyMetadataProperties(def: BlockDef, packedId: number, metadata?: BlockMetadata): BlockStateProperties {
  const result: BlockStateProperties = { ...(metadata?.blockState ?? {}) };
  const legacyMetadata = packedId >>> 10;
  const schema = def.stateSchema;
  if (!schema) return result;

  const facing = metadata?.stairFacing ?? metadata?.facing;
  if (facing) result.facing = facing;
  if (metadata?.slabHalf) result.type = metadata.slabHalf;
  if (metadata?.doorHalf) result.half = metadata.doorHalf;
  if (metadata?.hinge) result.hinge = metadata.hinge;
  if (metadata?.open !== undefined) result.open = metadata.open;
  if (metadata?.powered !== undefined) result.powered = metadata.powered;
  if (metadata?.extended !== undefined) result.extended = metadata.extended;
  if (metadata?.signal !== undefined) result.power = metadata.signal;
  if (metadata?.fluidLevel !== undefined) result.level = Math.max(0, 8 - metadata.fluidLevel);
  if (metadata?.rotation !== undefined) result.rotation = metadata.rotation;
  if (metadata?.fenceConnections) {
    const [north, south, east, west] = metadata.fenceConnections;
    Object.assign(result, { north: !!north, south: !!south, east: !!east, west: !!west });
  }

  if ('age' in schema.properties && result.age === undefined) result.age = legacyMetadata & 0xF;
  if ('power' in schema.properties && result.power === undefined) result.power = legacyMetadata & 0xF;
  if ('level' in schema.properties && result.level === undefined) result.level = legacyMetadata & 0xF;
  return result;
}

export function resolveBlockState(def: BlockDef, packedId: number, metadata?: BlockMetadata): BlockState {
  const baseId = def.baseId ?? (packedId & 0x3FF);
  return {
    baseId,
    packedId,
    legacyMetadata: packedId >>> 10,
    officialId: def.officialId,
    name: def.name,
    properties: normalizeBlockStateProperties(def.stateSchema, legacyMetadataProperties(def, packedId, metadata)),
  };
}

export function blockStateKey(state: BlockState): string {
  const properties = Object.entries(state.properties)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${String(value)}`)
    .join(',');
  return properties ? `${state.officialId ?? state.name}[${properties}]` : (state.officialId ?? state.name);
}

export function mergeBlockStateMetadata(
  metadata: BlockMetadata | undefined,
  properties: BlockStateProperties,
): BlockMetadata {
  return { ...(metadata ?? {}), blockState: { ...(metadata?.blockState ?? {}), ...properties } };
}

export function synchronizeBlockMetadata(
  def: BlockDef | undefined,
  packedId: number,
  metadata: BlockMetadata,
): BlockMetadata {
  if (!def?.stateSchema) return { ...metadata };
  return {
    ...metadata,
    blockState: resolveBlockState(def, packedId, metadata).properties,
  };
}
