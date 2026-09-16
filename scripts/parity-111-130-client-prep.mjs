import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/engine/Game.ts';
let source = readFileSync(path, 'utf8');
const pattern = /  private saveOpenChestInventory\(\) \{[\s\S]*?\n  \}\n/;
const matches = [...source.matchAll(new RegExp(pattern.source, 'g'))];
if (matches.length !== 1) throw new Error(`expected one saveOpenChestInventory method, got ${matches.length}`);

const normalized = `  saveOpenChestInventory() {
    if (!this.openChestPos) return;
    const metadata = this.chunks.getBlockMetadata(
      Math.floor(this.openChestPos.x),
      Math.floor(this.openChestPos.y),
      Math.floor(this.openChestPos.z),
    );
    if (metadata?.inventory && this.network.isConnected) {
      this.network.send(PacketType.C2S_CONTAINER_UPDATE, {
        x: Math.floor(this.openChestPos.x),
        y: Math.floor(this.openChestPos.y),
        z: Math.floor(this.openChestPos.z),
        slots: metadata.inventory,
      });
    }
  }
`;
source = source.replace(pattern, normalized);
writeFileSync(path, source, 'utf8');
console.log('normalized saveOpenChestInventory patch anchor');
