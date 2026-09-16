import { readFileSync, writeFileSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content, 'utf8'); }
function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`missing patch target: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`ambiguous patch target: ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}
function replaceRegexOnce(source, pattern, to, label) {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) throw new Error(`expected one ${label} match, got ${matches.length}`);
  return source.replace(pattern, to);
}
function replaceCount(source, from, to, count, label) {
  const actual = source.split(from).length - 1;
  if (actual !== count) throw new Error(`expected ${count} ${label} matches, got ${actual}`);
  return source.split(from).join(to);
}

// Game: one container session abstraction for chest/barrel/hopper, no implicit
// close from notifyState, and no legacy whole-snapshot upload loop.
{
  const path = 'src/engine/Game.ts';
  let s = read(path);

  s = replaceOnce(s,
`  /** P5.3 — throttle for uploading open-container contents. */
  private containerSyncTimer = 0;
`, '', 'legacy container sync timer');

  s = replaceRegexOnce(s,
/\n    \/\/ P5\.3: upload open-container contents \(server-validated authority\)\.\n    if \(this\.isMultiplayerNetworkConnected\(\) && \(this\.openUI as UIType\) === 'chest' && this\.openChestPos\) \{[\s\S]*?\n    \}\n(?=\n    \/\/)/,
'\n', 'legacy container snapshot upload loop');

  s = replaceOnce(s,
`  applyServerContainerData(x: number, y: number, z: number, slots: (ItemStack | null)[], cursor: ItemStack | null = null) {
    this.serverContainerCursor = cursor;
    if (!this.openChestPos || this.openChestPos.x !== x || this.openChestPos.y !== y || this.openChestPos.z !== z) return;
    const metadata = this.chunks.getBlockMeta(x, y, z);`,
`  applyServerContainerData(x: number, y: number, z: number, slots: (ItemStack | null)[], cursor: ItemStack | null = null) {
    const openPos = this.openChestPos ?? this.openHopperPos;
    if (!openPos || openPos.x !== x || openPos.y !== y || openPos.z !== z) return;
    this.serverContainerCursor = cursor;
    const metadata = this.chunks.getBlockMeta(x, y, z);`, 'apply server container to active session');

  s = replaceOnce(s,
`    this.openHopperPos = new THREE.Vector3(x, y, z);
    this.openUI = 'hopper';
    document.exitPointerLock();
  }`,
`    this.openHopperPos = new THREE.Vector3(x, y, z);
    this.openUI = 'hopper';
    document.exitPointerLock();
    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_CONTAINER_OPEN, { x, y, z });
    }
  }`, 'hopper authoritative open');

  s = replaceOnce(s,
`  saveOpenChestInventory() {
    if (!this.openChestPos || !this.network.isConnected) return;
    this.network.send(PacketType.C2S_CONTAINER_CLOSE, {});
    this.serverContainerCursor = null;
  }

  serverContainerClick(area: 'container' | 'player', slotIndex: number) {
    if (!this.network.isConnected || !this.openChestPos) return false;`,
`  private closeServerContainerSession() {
    if (!this.network.isConnected || (!this.openChestPos && !this.openHopperPos)) return;
    this.network.send(PacketType.C2S_CONTAINER_CLOSE, {});
    this.serverContainerCursor = null;
  }

  serverContainerClick(area: 'container' | 'player', slotIndex: number) {
    if (!this.network.isConnected || (!this.openChestPos && !this.openHopperPos)) return false;`, 'container close/click session abstraction');

  s = replaceOnce(s,
`  closeUI() {
    if (this.openUI === 'chest') {
      this.saveOpenChestInventory();
      this.openChestPos = null;
    } else if (this.openUI === 'hopper') {
      this.openHopperPos = null;`,
`  closeUI() {
    if (this.openUI === 'chest') {
      this.closeServerContainerSession();
      this.openChestPos = null;
    } else if (this.openUI === 'hopper') {
      this.closeServerContainerSession();
      this.openHopperPos = null;`, 'explicit close for chest and hopper');

  s = replaceOnce(s,
`  private notifyState() {
    if (this.openUI === 'chest') {
      this.saveOpenChestInventory();
    }
    this.player.updateArmorMesh(this.inventory.armor);`,
`  private notifyState() {
    this.player.updateArmorMesh(this.inventory.armor);`, 'notify state must not close container');

  write(path, s);
}

function patchContainerUI(path, kind) {
  let s = read(path);
  const isChest = kind === 'chest';
  const targetType = isChest ? 'chest' : 'hopper';
  const propTail = isChest
    ? `  titleKey?: 'chest' | 'doubleChest' | 'barrel';\n}`
    : `  onDropItem?: (itemId: number, count: number) => void;\n}`;
  const propReplacement = isChest
    ? `  titleKey?: 'chest' | 'doubleChest' | 'barrel';\n  serverCursor?: ItemStack | null;\n  onServerSlotClick?: (area: 'container' | 'player', slotIndex: number) => void;\n}`
    : `  onDropItem?: (itemId: number, count: number) => void;\n  serverCursor?: ItemStack | null;\n  onServerSlotClick?: (area: 'container' | 'player', slotIndex: number) => void;\n}`;
  s = replaceOnce(s, propTail, propReplacement, `${kind} authority props`);

  const destructureTail = isChest ? `  onDropItem,\n  titleKey,\n}) => {` : `  getItemIconStyle,\n  onDropItem,\n}) => {`;
  const destructureReplacement = isChest
    ? `  onDropItem,\n  titleKey,\n  serverCursor,\n  onServerSlotClick,\n}) => {`
    : `  getItemIconStyle,\n  onDropItem,\n  serverCursor,\n  onServerSlotClick,\n}) => {`;
  s = replaceOnce(s, destructureTail, destructureReplacement, `${kind} authority prop destructure`);

  s = replaceOnce(s,
`  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [, forceRender] = useState(0);`,
`  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const authoritative = Boolean(onServerSlotClick);
  const displayHeldItem = authoritative ? (serverCursor ?? null) : heldItem;
  const [, forceRender] = useState(0);`, `${kind} controlled cursor`);

  s = replaceOnce(s,
`  const handleSlotClick = useCallback((target: SlotTarget) => {
    const slotItem = getSlot(target);`,
`  const handleSlotClick = useCallback((target: SlotTarget) => {
    if (authoritative) {
      setHoveredSlot(null);
      onServerSlotClick?.(target.type === '${targetType}' ? 'container' : 'player', target.index);
      return;
    }
    const slotItem = getSlot(target);`, `${kind} intent-only click`);

  s = replaceOnce(s,
`  }, [getSlot, heldItem, notifyChanged, setSlot]);`,
`  }, [authoritative, getSlot, heldItem, notifyChanged, onServerSlotClick, setSlot]);`, `${kind} slot click dependencies`);

  s = replaceOnce(s,
`  const handleClose = useCallback(() => {
    if (heldItem) {`,
`  const handleClose = useCallback(() => {
    if (authoritative) {
      onClose();
      return;
    }
    if (heldItem) {`, `${kind} authoritative close`);

  const closeDeps = isChest
    ? `  }, [chestSlots, heldItem, inventory, notifyChanged, onClose]);`
    : `  }, [hopperSlots, heldItem, inventory, notifyChanged, onClose]);`;
  const closeDepsNext = isChest
    ? `  }, [authoritative, chestSlots, heldItem, inventory, notifyChanged, onClose]);`
    : `  }, [authoritative, hopperSlots, heldItem, inventory, notifyChanged, onClose]);`;
  s = replaceOnce(s, closeDeps, closeDepsNext, `${kind} close dependencies`);

  s = replaceOnce(s,
`      } else if (e.key.toLowerCase() === 'q') {
        if (heldItem) {`,
`      } else if (e.key.toLowerCase() === 'q') {
        if (authoritative) {
          e.preventDefault();
          return;
        }
        if (heldItem) {`, `${kind} authoritative q guard`);

  s = replaceOnce(s,
`  }, [handleClose, heldItem, hoveredSlot, getSlot, setSlot, notifyChanged, onDropItem]);`,
`  }, [authoritative, handleClose, heldItem, hoveredSlot, getSlot, setSlot, notifyChanged, onDropItem]);`, `${kind} key dependencies`);

  const hoverCount = isChest ? 2 : 1;
  s = replaceCount(s, `item && itemDef && !heldItem`, `item && itemDef && !displayHeldItem`, hoverCount, `${kind} hover cursor guard`);

  if (isChest) {
    s = replaceOnce(s,
`      onClick={() => {
        if (heldItem) {`,
`      onClick={() => {
        if (authoritative) return;
        if (heldItem) {`, 'chest backdrop authority guard');
  }

  const heldStart = isChest ? `      {heldItem && (\n        <div\n          id="chest-held-item"` : `      {heldItem && (\n        <div\n          id="hopper-held-item"`;
  const heldStartNext = isChest ? `      {displayHeldItem && (\n        <div\n          id="chest-held-item"` : `      {displayHeldItem && (\n        <div\n          id="hopper-held-item"`;
  s = replaceOnce(s, heldStart, heldStartNext, `${kind} controlled cursor render`);

  // Restrict substitutions to the held-item render region so singleplayer logic
  // continues to use the local heldItem state.
  const marker = isChest ? `      {/* Minecraft-style Premium Hover Tooltip */}` : `      {/* Tooltip Overlay */}`;
  const regionStart = s.indexOf(heldStartNext);
  const regionEnd = s.indexOf(marker, regionStart);
  if (regionStart < 0 || regionEnd < 0) throw new Error(`missing ${kind} held render region`);
  let region = s.slice(regionStart, regionEnd);
  region = region.split('heldItem.').join('displayHeldItem.');
  s = s.slice(0, regionStart) + region + s.slice(regionEnd);

  if (isChest) {
    s = replaceOnce(s, `{hoveredSlot && !heldItem && (`, `{hoveredSlot && !displayHeldItem && (`, 'chest tooltip cursor guard');
  } else {
    s = replaceOnce(s, `{hoveredSlot && (`, `{hoveredSlot && !displayHeldItem && (`, 'hopper tooltip cursor guard');
  }

  write(path, s);
}

patchContainerUI('src/ui/ChestUI.tsx', 'chest');
patchContainerUI('src/ui/HopperUI.tsx', 'hopper');

// App: stable server intent callback, enabled only while network-connected.
{
  const path = 'src/App.tsx';
  let s = read(path);
  s = replaceOnce(s,
`  const handleInventoryChange = useCallback(() => {
    // Force re-render by notifying state
    if (gameRef.current) {
      gameRef.current['notifyState']();
    }
  }, []);

  const handleDropItem`,
`  const handleInventoryChange = useCallback(() => {
    // Force re-render by notifying state
    if (gameRef.current) {
      gameRef.current['notifyState']();
    }
  }, []);

  const handleServerContainerClick = useCallback((area: 'container' | 'player', slotIndex: number) => {
    gameRef.current?.serverContainerClick(area, slotIndex);
  }, []);

  const handleDropItem`, 'stable server container callback');

  s = replaceOnce(s,
`          onDropItem={handleDropItem}
          titleKey={gameState.chestTitleKey}`, 
`          onDropItem={handleDropItem}
          serverCursor={gameState.serverContainerCursor}
          onServerSlotClick={gameState.networkStatus === 'connected' ? handleServerContainerClick : undefined}
          titleKey={gameState.chestTitleKey}`, 'chest controlled props');

  s = replaceOnce(s,
`          onDropItem={handleDropItem}
        />
      )}

      {/* Enchantment Table UI */}`,
`          onDropItem={handleDropItem}
          serverCursor={gameState.serverContainerCursor}
          onServerSlotClick={gameState.networkStatus === 'connected' ? handleServerContainerClick : undefined}
        />
      )}

      {/* Enchantment Table UI */}`, 'hopper controlled props');

  write(path, s);
}

console.log('authoritative chest/hopper UI hardening applied');
