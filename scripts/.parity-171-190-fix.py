from pathlib import Path

path = Path('src/systems/DroppedItemSystem.ts')
source = path.read_text()
needle = "  private mergeItems() {\n"
replacement = "  /** Compatibility seam for existing parity probes; shared behavior lives in ItemEntityRules. */\n  private isWithinVanillaPickupBounds(itemPos: THREE.Vector3, playerPos: THREE.Vector3): boolean {\n    return isWithinItemPickupBounds(itemPos, playerPos);\n  }\n\n  private mergeItems() {\n"
if source.count(needle) != 1:
    raise RuntimeError(f'Expected one DroppedItemSystem merge marker, got {source.count(needle)}')
path.write_text(source.replace(needle, replacement, 1))
print('Restored dropped-item pickup bounds compatibility seam.')
