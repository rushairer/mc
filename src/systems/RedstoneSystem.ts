/**
 * Basic redstone simulation system.
 * Supports: redstone wire, redstone torch, repeater, piston.
 *
 * Signal strength: 0-15 (0 = no signal, 15 = max)
 */

import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';
import type { BlockFacing } from '../types';

export interface RedstoneEntity {
  pos: { x: number; y: number; z: number };
  type: 'player' | 'mob' | 'item';
  width: number;
}

function tripwireHookMeta(facing: BlockFacing, attached: boolean, powered: boolean): number {
  let fVal = 0;
  if (facing === 'west') fVal = 1;
  else if (facing === 'north') fVal = 2;
  else if (facing === 'east') fVal = 3;
  return fVal + (attached ? 4 : 0) + (powered ? 8 : 0);
}

export interface RedstoneComponent {
  x: number;
  y: number;
  z: number;
  type: 'wire' | 'torch' | 'repeater' | 'piston' | 'lever' | 'button' | 'comparator' | 'observer' | 'daylight_detector' | 'pressure_plate' | 'tripwire_hook' | 'tripwire';
  signal: number;
  facing: BlockFacing;
  state: boolean; // on/off for torch, extended for piston, mode for comparator, active pulse for observer
}

const WIRE_ID = 31;     // redstone wire block ID (placeholder)
const TORCH_ID = 30;    // torch block ID (reuse)
const REPEATER_ID = 32; // repeater block ID (placeholder)
const PISTON_ID = 33;   // piston block ID (placeholder)
const LEVER_ID = 34;    // lever block ID (placeholder)

export class RedstoneSystem {
  private components: Map<string, RedstoneComponent> = new Map();
  private tickTimer = 0;
  private tickInterval = 0.1; // 10 ticks/sec (simplified from vanilla's 20)

  static key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  register(
    x: number,
    y: number,
    z: number,
    type: RedstoneComponent['type'],
    facing: RedstoneComponent['facing'] = 'north',
    initialState?: Partial<Pick<RedstoneComponent, 'signal' | 'state'>>
  ) {
    const key = RedstoneSystem.key(x, y, z);
    this.components.set(key, {
      x,
      y,
      z,
      type,
      signal: initialState?.signal ?? 0,
      facing,
      state: initialState?.state ?? false,
    });
  }

  unregister(x: number, y: number, z: number) {
    this.components.delete(RedstoneSystem.key(x, y, z));
  }

  get(x: number, y: number, z: number): RedstoneComponent | undefined {
    return this.components.get(RedstoneSystem.key(x, y, z));
  }

  update(
    dt: number,
    getBlock: (x: number, y: number, z: number) => number,
    setBlock: (x: number, y: number, z: number, id: number) => void,
    triggerSound?: (soundType: any) => void,
    onComponentChange?: (component: RedstoneComponent) => void,
    gameTime: number = 0,
    getBlockMeta?: (x: number, y: number, z: number) => any,
    entities: RedstoneEntity[] = []
  ) {
    this.tickTimer += dt;
    if (this.tickTimer < this.tickInterval) return;
    this.tickTimer = 0;

    // Reset all signals except sources
    for (const comp of this.components.values()) {
      if (
        comp.type !== 'torch' &&
        comp.type !== 'lever' &&
        comp.type !== 'daylight_detector' &&
        comp.type !== 'observer' &&
        comp.type !== 'comparator' &&
        comp.type !== 'pressure_plate' &&
        comp.type !== 'tripwire_hook' &&
        comp.type !== 'tripwire'
      ) {
        comp.signal = 0;
        if (comp.type !== 'piston') {
          comp.state = false;
        }
        onComponentChange?.(comp);
      }
    }

    // Tick sources first
    for (const comp of this.components.values()) {
      if (comp.type === 'torch') {
        const attachedBlock = this.getAttachedBlock(comp);
        const attachedKey = RedstoneSystem.key(attachedBlock[0], attachedBlock[1], attachedBlock[2]);
        const attachedComp = this.components.get(attachedKey);

        if (attachedComp && attachedComp.signal > 0) {
          comp.state = false; // torch turns off
          comp.signal = 0;
        } else {
          comp.state = true;
          comp.signal = 15;
        }
        onComponentChange?.(comp);
      } else if (comp.type === 'lever') {
        if (comp.state) {
          comp.signal = 15;
        } else {
          comp.signal = 0;
        }
        onComponentChange?.(comp);
      } else if (comp.type === 'daylight_detector') {
        const isDaylight = Math.sin(gameTime * 2 * Math.PI);
        const blockId = getBlock(comp.x, comp.y, comp.z);
        const baseId = blockId & 0x3FF;
        const isInverted = baseId === 178;
        let signalVal = 0;
        if (isDaylight > 0) {
          signalVal = Math.round(isDaylight * 15);
        }
        if (isInverted) {
          signalVal = 15 - signalVal;
        }
        comp.signal = Math.max(0, Math.min(15, signalVal));
        comp.state = comp.signal > 0;

        // Update block ID in chunk
        const currentMeta = (blockId >> 10) & 0xF;
        if (currentMeta !== comp.signal) {
          setBlock(comp.x, comp.y, comp.z, (comp.signal << 10) | baseId);
        }
        onComponentChange?.(comp);
      } else if (comp.type === 'observer') {
        if (comp.state) {
          comp.signal = 15;
          comp.state = false; // pulse ends
        } else {
          comp.signal = 0;
        }
        onComponentChange?.(comp);
      } else if (comp.type === 'pressure_plate') {
        const blockId = getBlock(comp.x, comp.y, comp.z);
        const baseId = blockId & 0x3FF;

        const activeEntities = entities.filter(e => {
          if (baseId === 70 && e.type === 'item') return false; // Stone doesn't detect items
          return this.isEntityOnBlock(e.pos, comp.x, comp.y, comp.z, e.width);
        });
        const count = activeEntities.length;

        let targetSignal = 0;
        if (count > 0) {
          if (baseId === 72 || baseId === 70) {
            targetSignal = 15;
          } else if (baseId === 147) { // light weighted (gold)
            targetSignal = Math.min(15, count);
          } else if (baseId === 148) { // heavy weighted (iron)
            targetSignal = Math.min(15, Math.ceil(count / 10));
          }
        }

        const becamePowered = targetSignal > 0;
        const wasPowered = comp.state;

        comp.signal = targetSignal;
        comp.state = becamePowered;

        const newMeta = becamePowered ? 1 : 0;
        setBlock(comp.x, comp.y, comp.z, (newMeta << 10) | baseId);

        if (becamePowered !== wasPowered) {
          triggerSound?.(becamePowered ? 'click_on' : 'click_off');
        }
        onComponentChange?.(comp);
      } else if (comp.type === 'tripwire_hook') {
        const blockId = getBlock(comp.x, comp.y, comp.z);
        const baseId = blockId & 0x3FF;

        const dir = this.getFacingDirection(comp.facing);
        const opp = this.getOppositeFacing(comp.facing);
        let foundMatch = false;
        let matchHook: RedstoneComponent | null = null;
        const stringsList: [number, number, number][] = [];

        for (let dist = 1; dist <= 40; dist++) {
          const sx = comp.x + dir[0] * dist;
          const sy = comp.y;
          const sz = comp.z + dir[2] * dist;
          const bid = getBlock(sx, sy, sz);
          const base = bid & 0x3FF;

          if (base === 132) { // tripwire string
            stringsList.push([sx, sy, sz]);
          } else if (base === 131) { // tripwire hook
            const neigh = this.get(sx, sy, sz);
            if (neigh && neigh.facing === opp) {
              foundMatch = true;
              matchHook = neigh;
            }
            break;
          } else {
            break;
          }
        }

        let isPowered = false;
        if (foundMatch && matchHook) {
          const checkBlocks = [[comp.x, comp.y, comp.z], [matchHook.x, matchHook.y, matchHook.z], ...stringsList];
          isPowered = entities.some(e =>
            checkBlocks.some(([bx, by, bz]) => this.isEntityOnBlock(e.pos, bx, by, bz, e.width))
          );
        }

        const wasPowered = comp.state;
        comp.signal = isPowered ? 15 : 0;
        comp.state = isPowered;

        const metadataValue = tripwireHookMeta(comp.facing, foundMatch, isPowered);
        setBlock(comp.x, comp.y, comp.z, (metadataValue << 10) | baseId);

        if (isPowered !== wasPowered) {
          triggerSound?.(isPowered ? 'click_on' : 'click_off');
        }
        onComponentChange?.(comp);

        if (foundMatch) {
          for (const [sx, sy, sz] of stringsList) {
            const sMeta = isPowered ? 7 : 6;
            setBlock(sx, sy, sz, (sMeta << 10) | 132);
          }
        }
      } else if (comp.type === 'tripwire') {
        const blockId = getBlock(comp.x, comp.y, comp.z);
        const meta = blockId >> 10;
        const isAttached = meta === 6 || meta === 7;

        if (!isAttached) {
          const hasEntity = entities.some(e => this.isEntityOnBlock(e.pos, comp.x, comp.y, comp.z, e.width));
          const sMeta = hasEntity ? 3 : 2;
          setBlock(comp.x, comp.y, comp.z, (sMeta << 10) | 132);
        }
      }
    }

    // Propagate signal through wires (BFS)
    const queue: RedstoneComponent[] = [];
    for (const comp of this.components.values()) {
      if (
        comp.signal > 0 &&
        (comp.type === 'torch' ||
          comp.type === 'lever' ||
          comp.type === 'daylight_detector' ||
          comp.type === 'observer' ||
          comp.type === 'comparator' ||
          comp.type === 'pressure_plate' ||
          comp.type === 'tripwire_hook')
      ) {
        queue.push(comp);
      }
    }

    this.propagate(queue, getBlock, setBlock, triggerSound, onComponentChange);

    // Update comparators based on stable inputs
    if (getBlockMeta) {
      let comparatorChanged = true;
      let iterations = 0;

      while (comparatorChanged && iterations < 10) {
        comparatorChanged = false;
        iterations++;
        const changedComparators: RedstoneComponent[] = [];

        for (const comp of this.components.values()) {
          if (comp.type === 'comparator') {
            const blockId = getBlock(comp.x, comp.y, comp.z);
            const baseId = blockId & 0x3FF;
            const meta = blockId >> 10;
            const subtractMode = (meta & 4) !== 0;

            const dirs = this.getComparatorDirections(comp.facing);

            // 1. Back input
            const bx = comp.x + dirs.back[0];
            const by = comp.y + dirs.back[1];
            const bz = comp.z + dirs.back[2];

            let backSignal = 0;
            const containerSignal = this.getContainerSignal(bx, by, bz, getBlockMeta);
            if (containerSignal !== null) {
              backSignal = containerSignal;
            } else {
              const backComp = this.get(bx, by, bz);
              backSignal = backComp ? backComp.signal : 0;
            }

            // 2. Side inputs
            const lx = comp.x + dirs.left[0];
            const ly = comp.y + dirs.left[1];
            const lz = comp.z + dirs.left[2];
            const leftComp = this.get(lx, ly, lz);
            const leftSignal = leftComp ? leftComp.signal : 0;

            const rx = comp.x + dirs.right[0];
            const ry = comp.y + dirs.right[1];
            const rz = comp.z + dirs.right[2];
            const rightComp = this.get(rx, ry, rz);
            const rightSignal = rightComp ? rightComp.signal : 0;

            const sideSignal = Math.max(leftSignal, rightSignal);

            // 3. Compute output
            let output = 0;
            if (subtractMode) {
              output = Math.max(0, backSignal - sideSignal);
            } else {
              output = backSignal >= sideSignal ? backSignal : 0;
            }

            if (comp.signal !== output) {
              comp.signal = output;
              comp.state = output > 0;

              const newBaseId = output > 0 ? 150 : 149;
              setBlock(comp.x, comp.y, comp.z, (meta << 10) | newBaseId);

              onComponentChange?.(comp);
              changedComparators.push(comp);
              comparatorChanged = true;
            }
          }
        }

        if (changedComparators.length > 0) {
          this.propagate(changedComparators, getBlock, setBlock, triggerSound, onComponentChange);
        }
      }
    }
  }

  private propagate(
    queue: RedstoneComponent[],
    getBlock: (x: number, y: number, z: number) => number,
    setBlock: (x: number, y: number, z: number, id: number) => void,
    triggerSound?: (soundType: any) => void,
    onComponentChange?: (component: RedstoneComponent) => void
  ) {
    const visited = new Set<string>();
    for (const comp of queue) {
      visited.add(RedstoneSystem.key(comp.x, comp.y, comp.z));
    }

    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const newSignal = Math.max(0, current.signal - 1);

      // Repeater and comparator only propagate in their facing direction; tripwire hook only propagates to its attached block
      const isRepeaterOrComparator = current.type === 'repeater' || current.type === 'comparator';
      const isTripwireHook = current.type === 'tripwire_hook';
      const allowedDirs = isRepeaterOrComparator
        ? [this.getFacingDirection(current.facing)]
        : (isTripwireHook ? [this.getFacingDirection(this.getOppositeFacing(current.facing))] : dirs);

      for (const [dx, dy, dz] of allowedDirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nz = current.z + dz;
        const key = RedstoneSystem.key(nx, ny, nz);

        if (visited.has(key)) continue;

        const neighbor = this.components.get(key);
        if (!neighbor) continue;

        if (neighbor.type === 'wire' && neighbor.signal < newSignal) {
          neighbor.signal = newSignal;
          onComponentChange?.(neighbor);
          queue.push(neighbor);
          visited.add(key);
        } else if (neighbor.type === 'repeater') {
          if (this.isRepeaterInput(neighbor, current)) {
            neighbor.signal = 15;
            neighbor.state = true;
            onComponentChange?.(neighbor);
            queue.push(neighbor);
            visited.add(key);
          }
        } else if (neighbor.type === 'piston') {
          if (newSignal > 0 && !neighbor.state) {
            neighbor.state = true;
            onComponentChange?.(neighbor);
            if (triggerSound) triggerSound('piston_extend');

            const pDir = this.getFacingDirection(neighbor.facing);
            const frontX = neighbor.x + pDir[0];
            const frontY = neighbor.y + pDir[1];
            const frontZ = neighbor.z + pDir[2];
            const pushId = getBlock(frontX, frontY, frontZ);

            if (pushId !== 0 && (pushId & 0x3FF) !== 49 && !BlockRegistry.isFluid(pushId)) {
              const targetX = frontX + pDir[0];
              const targetY = frontY + pDir[1];
              const targetZ = frontZ + pDir[2];
              if (getBlock(targetX, targetY, targetZ) === 0) {
                setBlock(targetX, targetY, targetZ, pushId);
                setBlock(frontX, frontY, frontZ, 0);
              }
            }
          } else if (newSignal === 0 && neighbor.state) {
            neighbor.state = false;
            onComponentChange?.(neighbor);
            if (triggerSound) triggerSound('piston_retract');
          }
        }
      }
    }
  }

  observeBlockChange(x: number, y: number, z: number) {
    const neighborDirs: { dir: [number, number, number]; targetFacing: BlockFacing }[] = [
      { dir: [1, 0, 0], targetFacing: 'west' },
      { dir: [-1, 0, 0], targetFacing: 'east' },
      { dir: [0, 1, 0], targetFacing: 'down' },
      { dir: [0, -1, 0], targetFacing: 'up' },
      { dir: [0, 0, 1], targetFacing: 'north' },
      { dir: [0, 0, -1], targetFacing: 'south' },
    ];
    for (const { dir, targetFacing } of neighborDirs) {
      const nx = x + dir[0];
      const ny = y + dir[1];
      const nz = z + dir[2];
      const comp = this.get(nx, ny, nz);
      if (comp && comp.type === 'observer') {
        if (comp.facing === targetFacing) {
          comp.state = true; // start pulse
        }
      }
    }
  }

  private isEntityOnBlock(entityPos: { x: number; y: number; z: number }, x: number, y: number, z: number, entityWidth = 0.6): boolean {
    const halfW = entityWidth / 2;
    const xMin = x - halfW;
    const xMax = x + 1 + halfW;
    const zMin = z - halfW;
    const zMax = z + 1 + halfW;
    return (
      entityPos.y >= y - 0.15 &&
      entityPos.y <= y + 0.25 &&
      entityPos.x >= xMin &&
      entityPos.x <= xMax &&
      entityPos.z >= zMin &&
      entityPos.z <= zMax
    );
  }

  private getComparatorDirections(facing: BlockFacing): {
    front: [number, number, number];
    back: [number, number, number];
    left: [number, number, number];
    right: [number, number, number];
  } {
    switch (facing) {
      case 'north':
        return { front: [0, 0, -1], back: [0, 0, 1], left: [-1, 0, 0], right: [1, 0, 0] };
      case 'south':
        return { front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0] };
      case 'east':
        return { front: [1, 0, 0], back: [-1, 0, 0], left: [0, 0, -1], right: [0, 0, 1] };
      case 'west':
        return { front: [-1, 0, 0], back: [1, 0, 0], left: [0, 0, 1], right: [0, 0, -1] };
      default:
        return { front: [0, 0, -1], back: [0, 0, 1], left: [-1, 0, 0], right: [1, 0, 0] };
    }
  }

  private getOppositeFacing(facing: BlockFacing): BlockFacing {
    switch (facing) {
      case 'up': return 'down';
      case 'down': return 'up';
      case 'north': return 'south';
      case 'south': return 'north';
      case 'east': return 'west';
      case 'west': return 'east';
    }
  }

  private getContainerSignal(
    x: number,
    y: number,
    z: number,
    getBlockMeta: (x: number, y: number, z: number) => any
  ): number | null {
    const meta = getBlockMeta(x, y, z);
    if (!meta || !meta.containerType || !meta.inventory) return null;
    const inventory: any[] = meta.inventory;
    let sumCounts = 0;
    let sumMaxStacks = 0;
    let hasItems = false;
    for (const slot of inventory) {
      if (slot && slot.count > 0) {
        hasItems = true;
        sumCounts += slot.count;
        const itemDef = ItemRegistry.get(slot.id);
        const maxStack = itemDef?.maxStackSize ?? 64;
        sumMaxStacks += maxStack;
      } else {
        sumMaxStacks += 64;
      }
    }
    if (!hasItems) return 0;
    return Math.floor(1 + 14 * sumCounts / sumMaxStacks);
  }

  private getFacingDirection(facing: RedstoneComponent['facing']): [number, number, number] {
    const dirs: Record<string, [number, number, number]> = {
      north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0],
      up: [0, 1, 0], down: [0, -1, 0],
    };
    return dirs[facing] ?? [0, 0, -1];
  }

  private getAttachedBlock(comp: RedstoneComponent): [number, number, number] {
    const dirs: Record<string, [number, number, number]> = {
      north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0],
      up: [0, 1, 0], down: [0, -1, 0],
    };
    const d = dirs[comp.facing] ?? [0, -1, 0];
    return [comp.x + d[0], comp.y + d[1], comp.z + d[2]];
  }

  private isRepeaterInput(repeater: RedstoneComponent, source: RedstoneComponent): boolean {
    const dx = Math.abs(repeater.x - source.x);
    const dy = Math.abs(repeater.y - source.y);
    const dz = Math.abs(repeater.z - source.z);
    return dx + dy + dz === 1;
  }

  toggleLever(x: number, y: number, z: number): boolean {
    const comp = this.get(x, y, z);
    if (comp && comp.type === 'lever') {
      comp.state = !comp.state;
      return comp.state;
    }
    return false;
  }

  dispose() {
    this.components.clear();
  }
}
