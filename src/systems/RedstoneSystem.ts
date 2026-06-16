/**
 * Basic redstone simulation system.
 * Supports: redstone wire, redstone torch, repeater, piston.
 *
 * Signal strength: 0-15 (0 = no signal, 15 = max)
 */

export interface RedstoneComponent {
  x: number;
  y: number;
  z: number;
  type: 'wire' | 'torch' | 'repeater' | 'piston' | 'lever' | 'button';
  signal: number;
  facing: 'north' | 'south' | 'east' | 'west' | 'up' | 'down';
  state: boolean; // on/off for torch, extended for piston
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

  register(x: number, y: number, z: number, type: RedstoneComponent['type'], facing: RedstoneComponent['facing'] = 'north') {
    const key = RedstoneSystem.key(x, y, z);
    this.components.set(key, {
      x, y, z, type, signal: 0, facing, state: false,
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
    setBlock: (x: number, y: number, z: number, id: number) => void
  ) {
    this.tickTimer += dt;
    if (this.tickTimer < this.tickInterval) return;
    this.tickTimer = 0;

    // Reset all signals
    for (const comp of this.components.values()) {
      if (comp.type !== 'torch') {
        comp.signal = 0;
      }
    }

    // Tick sources first (torches, levers)
    for (const comp of this.components.values()) {
      if (comp.type === 'torch') {
        // Torch provides signal 15 unless the block it's attached to is powered
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
      } else if (comp.type === 'lever') {
        if (comp.state) {
          comp.signal = 15;
        }
      }
    }

    // Propagate signal through wires (BFS)
    const queue: RedstoneComponent[] = [];
    const visited = new Set<string>();

    for (const comp of this.components.values()) {
      if (comp.signal > 0 && (comp.type === 'torch' || comp.type === 'lever')) {
        queue.push(comp);
        visited.add(RedstoneSystem.key(comp.x, comp.y, comp.z));
      }
    }

    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const newSignal = Math.max(0, current.signal - 1);

      for (const [dx, dy, dz] of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nz = current.z + dz;
        const key = RedstoneSystem.key(nx, ny, nz);

        if (visited.has(key)) continue;

        const neighbor = this.components.get(key);
        if (!neighbor) continue;

        if (neighbor.type === 'wire' && neighbor.signal < newSignal) {
          neighbor.signal = newSignal;
          queue.push(neighbor);
          visited.add(key);
        } else if (neighbor.type === 'repeater') {
          // Repeater: signal in one side, signal out other side (15)
          if (this.isRepeaterInput(neighbor, current)) {
            neighbor.signal = 15;
            neighbor.state = true;
          }
        } else if (neighbor.type === 'piston') {
          // Piston extends when powered
          if (newSignal > 0 && !neighbor.state) {
            neighbor.state = true;
            // Push block in facing direction (simplified: just set state)
          } else if (newSignal === 0 && neighbor.state) {
            neighbor.state = false;
          }
        }
      }
    }
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
    // Simplified: any adjacent signal counts as input
    const dx = Math.abs(repeater.x - source.x);
    const dy = Math.abs(repeater.y - source.y);
    const dz = Math.abs(repeater.z - source.z);
    return dx + dy + dz === 1;
  }

  /** Toggle a lever at position. Returns new state. */
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
