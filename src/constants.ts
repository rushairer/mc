// ─── World Dimensions ───
export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 256;
export const SEA_LEVEL = 96;
export const RENDER_DISTANCE = 6;

// ─── Physics ───
export const BLOCK_SIZE = 1;
export const GRAVITY = -28;
export const JUMP_VELOCITY = 9;
export const WALK_SPEED = 4.3;
export const SPRINT_SPEED = 5.6;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.62;
export const MAX_REACH = 4.5;

// ─── Tick ───
export const TICK_RATE = 20;
export const TICK_INTERVAL = 1000 / TICK_RATE;

// ─── Block Face Directions ───
export const FACE_DIRS: [number, number, number][] = [
  [0, 1, 0],   // top
  [0, -1, 0],  // bottom
  [1, 0, 0],   // right
  [-1, 0, 0],  // left
  [0, 0, 1],   // front
  [0, 0, -1],  // back
];

export const FACE_VERTICES: [number, number, number][][][] = [
  // top (y+)
  [[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]],
  // bottom (y-)
  [[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
  // right (x+)
  [[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],
  // left (x-)
  [[[0,0,1],[0,1,1],[0,1,0],[0,0,0]]],
  // front (z+)
  [[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]],
  // back (z-)
  [[[1,0,0],[0,0,0],[0,1,0],[1,1,0]]],
];
