export const END_PORTAL_BLOCK_ID = 119;
export const END_PORTAL_FRAME_BLOCK_ID = 120;

export type EndPortalBlockGetter = (x: number, y: number, z: number) => number;

export function fillEndPortalFrameBlock(
  blockId: number,
  frameId = END_PORTAL_FRAME_BLOCK_ID,
): number | null {
  const baseId = blockId & 0x3ff;
  const metadata = (blockId >> 10) & 0x0f;
  if (baseId !== frameId || metadata >= 4) return null;
  return ((metadata + 4) << 10) | frameId;
}

export function isFilledEndPortalFrame(
  blockId: number,
  frameId = END_PORTAL_FRAME_BLOCK_ID,
): boolean {
  return (blockId & 0x3ff) === frameId && ((blockId >> 10) & 0x0f) >= 4;
}

export function isCompleteEndPortalAt(
  getBlock: EndPortalBlockGetter,
  centerX: number,
  y: number,
  centerZ: number,
  frameId = END_PORTAL_FRAME_BLOCK_ID,
  portalId = END_PORTAL_BLOCK_ID,
): boolean {
  let frameCount = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const onFrame = (Math.abs(dx) === 2 && Math.abs(dz) <= 1)
        || (Math.abs(dz) === 2 && Math.abs(dx) <= 1);
      const inside = Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
      const blockId = getBlock(centerX + dx, y, centerZ + dz);
      if (onFrame) {
        if (!isFilledEndPortalFrame(blockId, frameId)) return false;
        frameCount++;
      } else if (inside) {
        const baseId = blockId & 0x3ff;
        if (baseId !== 0 && baseId !== portalId) return false;
      }
    }
  }
  return frameCount === 12;
}

export function findCompleteEndPortalCenter(
  getBlock: EndPortalBlockGetter,
  frameX: number,
  y: number,
  frameZ: number,
  frameId = END_PORTAL_FRAME_BLOCK_ID,
  portalId = END_PORTAL_BLOCK_ID,
): { x: number; y: number; z: number } | null {
  for (let centerX = frameX - 2; centerX <= frameX + 2; centerX++) {
    for (let centerZ = frameZ - 2; centerZ <= frameZ + 2; centerZ++) {
      if (isCompleteEndPortalAt(getBlock, centerX, y, centerZ, frameId, portalId)) {
        return { x: centerX, y, z: centerZ };
      }
    }
  }
  return null;
}

export function getEndPortalInteriorCells(centerX: number, y: number, centerZ: number) {
  const cells: Array<{ x: number; y: number; z: number }> = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      cells.push({ x: centerX + dx, y, z: centerZ + dz });
    }
  }
  return cells;
}
