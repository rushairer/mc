import { coordinateRandom } from '../engine/DeterministicRandom';

export interface EnderEyeTarget {
  x: number;
  y: number;
  z: number;
}

export function findEnderEyeTarget(seed: number, playerX: number, playerZ: number): EnderEyeTarget {
  const spacing = 24;
  const offsetX = Math.floor(coordinateRandom(seed, seed, 19, 7) * spacing);
  const offsetZ = Math.floor(coordinateRandom(seed, seed, 31, 11) * spacing);
  const pcx = Math.floor(playerX / 16);
  const pcz = Math.floor(playerZ / 16);

  let nearestDistance = Infinity;
  let nearestX = 0;
  let nearestZ = 8;
  let nearestY = 30;

  for (let i = -10; i <= 10; i++) {
    for (let j = -10; j <= 10; j++) {
      const scx = offsetX + Math.round((pcx - offsetX) / spacing + i) * spacing;
      const scz = offsetZ + Math.round((pcz - offsetZ) / spacing + j) * spacing;
      if (Math.hypot(scx, scz) < 8) continue;

      const sx = scx * 16 + 8;
      const sz = scz * 16 + 8;
      const dx = sx - playerX;
      const dz = sz - playerZ;
      const distance = dx * dx + dz * dz;
      if (distance >= nearestDistance) continue;

      nearestDistance = distance;
      nearestX = sx;
      nearestZ = sz;
      nearestY = 28 + Math.floor(coordinateRandom(seed, scx, seed, scz) * 22);
    }
  }

  return { x: nearestX, y: nearestY, z: nearestZ };
}

/** Java Eyes of Ender have a 20% chance to shatter after a locating throw. */
export function shouldEnderEyeShatter(
  seed: number,
  projectileId: number,
  x: number,
  z: number,
): boolean {
  return coordinateRandom(seed, projectileId, Math.floor(x), Math.floor(z)) < 0.2;
}
