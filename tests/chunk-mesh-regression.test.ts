import assert from 'node:assert/strict';
import test from 'node:test';
import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL } from '../src/constants';
import { Chunk } from '../src/world/Chunk';
import { WorldGen } from '../src/world/WorldGen';
import { BlockRegistry } from '../src/world/BlockRegistry';

/**
 * P1.9 — Fixed-seed chunk lighting / mesh / world-generation regression.
 *
 * These tests run headless in Node (no DOM, no WebGL): WorldGen, Chunk light
 * computation and Chunk.buildMesh only need injected callbacks and a stub
 * atlas, so the whole pipeline is fully automatable.
 *
 * The SEED_HASH_SNAPSHOT pins are the tripwire: any intended change to world
 * generation, lighting or mesh construction that alters output for seed 12345
 * must update these pins deliberately, with evidence of the change.
 */

const SEED = 12345;

const STUB_ATLAS = { getUV: () => ({ u0: 0, v0: 0, u1: 1, v1: 1 }) };

function fnv1a(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hashChunk(chunk: Chunk): number {
  const data = fnv1a(new Uint8Array(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength));
  const sky = fnv1a(chunk.skyLight);
  const block = fnv1a(chunk.blockLight);
  return ((data * 31 + sky) * 31 + block) >>> 0;
}

function countNonAir(chunk: Chunk): number {
  let n = 0;
  for (let i = 0; i < chunk.data.length; i++) if (chunk.data[i] !== 0) n++;
  return n;
}

function neighborLookup(chunks: Map<string, Chunk>) {
  return (wx: number, wy: number, wz: number) => {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const c = chunks.get(`${cx},${cz}`);
    return c ? c.getBlock(wx - cx * CHUNK_SIZE, wy, wz - cz * CHUNK_SIZE) : 0;
  };
}

/** Generate + light a chunk with the given seed. */
function generateChunk(seed: number, cx: number, cz: number): Chunk {
  const chunk = new Chunk(cx, cz);
  new WorldGen(seed).generateChunk(chunk);
  chunk.computeSkyLight(neighborLookup(new Map([[`${cx},${cz}`, chunk]])));
  chunk.computeBlockLight();
  return chunk;
}

function buildMesh(chunk: Chunk, chunks: Map<string, Chunk>) {
  return chunk.buildMesh(STUB_ATLAS, neighborLookup(chunks), () => 15, () => 0, 0.25, () => 0);
}

// ─── World generation determinism ───

test('generates identical chunk data for the same seed', () => {
  for (const [cx, cz] of [[0, 0], [-1, 2], [3, -2]] as const) {
    const a = new Chunk(cx, cz);
    new WorldGen(SEED).generateChunk(a);
    const b = new Chunk(cx, cz);
    new WorldGen(SEED).generateChunk(b);
    assert.deepEqual(a.data, b.data, `chunk(${cx},${cz}) data must be seed-deterministic`);
  }
});

test('different seeds produce different terrain', () => {
  const a = generateChunk(12345, 0, 0);
  const b = generateChunk(12346, 0, 0);
  assert.notEqual(hashChunk(a), hashChunk(b));
});

test('spawn-area chunks generate without error and contain terrain', () => {
  const gen = new WorldGen(SEED);
  for (let cx = -1; cx <= 1; cx++) {
    for (let cz = -1; cz <= 1; cz++) {
      const chunk = new Chunk(cx, cz);
      assert.doesNotThrow(() => gen.generateChunk(chunk), `chunk(${cx},${cz}) must generate`);
      assert.ok(countNonAir(chunk) > 5000, `chunk(${cx},${cz}) should contain terrain`);
      assert.notEqual(chunk.getBlock(8, 0, 8), 0, 'bedrock floor should exist at y=0');
    }
  }
});

// ─── Lighting invariants ───

test('lighting values stay within [0,15] and sky reaches the surface', () => {
  const chunk = generateChunk(SEED, 0, 0);
  let maxSky = 0;
  let sawSurfaceAir = false;
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const sky = chunk.skyLight[chunk.getIndex(x, y, z)];
        const block = chunk.blockLight[chunk.getIndex(x, y, z)];
        assert.ok(sky >= 0 && sky <= 15, `skyLight ${sky} out of range`);
        assert.ok(block >= 0 && block <= 15, `blockLight ${block} out of range`);
        maxSky = Math.max(maxSky, sky);
        if (y > SEA_LEVEL && sky === 15 && chunk.getBlock(x, y, z) === 0) sawSurfaceAir = true;
      }
    }
  }
  assert.equal(maxSky, 15, 'open surface air must receive full sky light');
  assert.ok(sawSurfaceAir, 'expected sky-lit air above sea level');
});

test('deep sealed cells under opaque overburden stay dark', () => {
  const chunk = new Chunk(0, 0);
  // Full stone slabs at y=1..2 block all sky light from below.
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      chunk.setBlock(x, 1, z, 1);
      chunk.setBlock(x, 2, z, 1);
    }
  }
  chunk.computeSkyLight(neighborLookup(new Map([['0,0', chunk]])));
  for (let x = 0; x < CHUNK_SIZE; x += 4) {
    for (let z = 0; z < CHUNK_SIZE; z += 4) {
      assert.equal(chunk.skyLight[chunk.getIndex(x, 0, z)], 0, 'cell under stone must be dark');
    }
  }
  assert.equal(chunk.skyLight[chunk.getIndex(8, WORLD_HEIGHT - 1, 8)], 15, 'open sky stays lit');
});

test('torch emits decaying block light', () => {
  const chunk = new Chunk(0, 0);
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      chunk.setBlock(x, 1, z, 1); // stone floor
    }
  }
  chunk.setBlock(8, 2, 8, 50); // torch (luminance 14)
  chunk.computeBlockLight();
  assert.equal(chunk.blockLight[chunk.getIndex(8, 2, 8)], 14);
  assert.equal(chunk.blockLight[chunk.getIndex(9, 2, 8)], 13);
  assert.equal(chunk.blockLight[chunk.getIndex(10, 2, 8)], 12);
  assert.equal(chunk.blockLight[chunk.getIndex(8, 2, 0)], 6, 'light decays 14-8=6 over 8 cells');
  assert.equal(chunk.blockLight[chunk.getIndex(8, 0, 8)], 0, 'opaque floor blocks downward spread');
});

// ─── Mesh invariants ───

test('generated chunk mesh has valid topology and no NaNs', () => {
  const chunks = new Map<string, Chunk>();
  const chunk = new Chunk(0, 0);
  new WorldGen(SEED).generateChunk(chunk);
  chunks.set('0,0', chunk);
  chunk.computeSkyLight(neighborLookup(chunks));
  chunk.computeBlockLight();

  const { solidGeo, transparentGeo } = buildMesh(chunk, chunks);
  for (const [label, geo] of [['solid', solidGeo], ['transparent', transparentGeo]] as const) {
    const positions = geo.attributes.position;
    const normals = geo.attributes.normal;
    const uvs = geo.attributes.uv;
    const vertexCount = positions.count;
    assert.equal(normals.count, vertexCount, `${label} normals length`);
    assert.equal(uvs.count, vertexCount, `${label} uvs length`);
    assert.equal(positions.array.length % 3, 0, `${label} position coordinates form triples`);
    const index = geo.index;
    if (index) {
      assert.equal(index.count % 3, 0, `${label} indices form triangles`);
      let maxIndex = 0;
      for (let i = 0; i < index.count; i++) maxIndex = Math.max(maxIndex, index.getX(i));
      assert.ok(maxIndex < vertexCount, `${label} indices reference valid vertices`);
    }
    for (let i = 0; i < positions.count * 3; i++) {
      assert.ok(Number.isFinite(positions.array[i]), `${label} position must be finite`);
    }
    for (let i = 0; i < uvs.count * 2; i++) {
      const v = uvs.array[i];
      assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, `${label} uv in [0,1]`);
    }
  }
});

test('mesh rebuild is deterministic for the same chunk', () => {
  const chunks = new Map<string, Chunk>();
  const chunk = new Chunk(0, 0);
  new WorldGen(SEED).generateChunk(chunk);
  chunks.set('0,0', chunk);
  chunk.computeSkyLight(neighborLookup(chunks));
  chunk.computeBlockLight();

  const first = buildMesh(chunk, chunks).solidGeo.attributes.position.array.slice();
  const second = buildMesh(chunk, chunks).solidGeo.attributes.position.array.slice();
  assert.deepEqual(first, second);
});

test('single floating block renders all six faces', () => {
  const chunk = new Chunk(0, 0);
  chunk.setBlock(0, 1, 0, 1); // stone surrounded by air on every side
  const { solidGeo } = buildMesh(chunk, new Map([['0,0', chunk]]));
  assert.equal(solidGeo.attributes.position.count, 24, '6 faces x 4 vertices');
  assert.equal(solidGeo.index?.count, 36, '6 faces x 6 indices');
});

test('interior faces are culled; only world-boundary faces remain', () => {
  const chunk = new Chunk(0, 0);
  // Fill the whole chunk with stone: every interior face is culled.
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) chunk.setBlock(x, y, z, 1);
    }
  }
  // Every neighbor reports stone, so the only visible faces are the chunk's
  // top layer (y=255 up, 16x16) and bottom layer (y=0 down, 16x16):
  // 512 faces x 4 vertices = 2048 solid vertices, nothing transparent.
  const { solidGeo, transparentGeo } = chunk.buildMesh(STUB_ATLAS, () => 1, () => 15, () => 0, 0.25, () => 0);
  assert.equal(solidGeo.attributes.position?.count ?? 0, 2048);
  assert.equal(transparentGeo.attributes.position?.count ?? 0, 0);
});

// ─── Fixed-seed hash snapshot (regression tripwire) ───

test('fixed-seed hash snapshot stays stable (update pins deliberately)', () => {
  const expected = new Map<string, { hash: number; nonAir: number; solidVerts: number; solidIdx: number; transVerts: number; transIdx: number }>([
    ['0,0', { hash: 0xa223977c, nonAir: 24681, solidVerts: 29588, solidIdx: 44382, transVerts: 9688, transIdx: 14532 }],
    ['-1,2', { hash: 0xea21e1fa, nonAir: 24832, solidVerts: 23528, solidIdx: 35292, transVerts: 10208, transIdx: 15312 }],
  ]);

  for (const [key, pin] of expected) {
    const [cx, cz] = key.split(',').map(Number);
    const chunks = new Map<string, Chunk>();
    const chunk = new Chunk(cx, cz);
    new WorldGen(SEED).generateChunk(chunk);
    chunks.set(key, chunk);
    chunk.computeSkyLight(neighborLookup(chunks));
    chunk.computeBlockLight();
    const { solidGeo, transparentGeo } = buildMesh(chunk, chunks);
    const actual = {
      hash: hashChunk(chunk),
      nonAir: countNonAir(chunk),
      solidVerts: solidGeo.attributes.position.count,
      solidIdx: solidGeo.index?.count ?? 0,
      transVerts: transparentGeo.attributes.position.count,
      transIdx: transparentGeo.index?.count ?? 0,
    };
    assert.deepEqual(actual, pin, `seed ${SEED} chunk(${key}) snapshot changed`);
  }
});

// The BlockRegistry import guards against accidental tree-shaking of registry
// data used by the mesh builder.
assert.ok(BlockRegistry.get(1), 'stone registered');
