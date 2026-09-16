import fs from 'node:fs';
const p='src/ui/FurnaceUI.tsx';
let s=fs.readFileSync(p,'utf8');
const from=`                onClick={() => {
                  if (!item) return;
                  const recipe = findSmeltingResult(item.id);
                  const isFuel = isSmeltingFuel(item.id);

                  setHoveredSlot(null);

                  if (recipe && !inputSlot) {
                    // Check if input is valid for the specific container type
                    const itemDef = ItemRegistry.get(item.id);
                    let isValid = true;
                    if (itemDef) {
                      if (containerType === 'smoker') {
                        isValid = ItemRegistry.isFood(item.id) || ItemRegistry.isFood(recipe.output);
                      } else if (containerType === 'blast_furnace') {
                        isValid = (itemDef.name.includes('ore') || itemDef.name.startsWith('raw_')) && !ItemRegistry.isFood(item.id);
                      }
                    } else {
                      isValid = false;
                    }

                    if (isValid) {
                      setInputSlot({ id: item.id, count: 1 });
                      inventory.removeFromSlot(i);
                      onInventoryChange();
                    }
                  } else if (isFuel && !fuelSlot) {
                    setFuelSlot({ id: item.id, count: 1 });
                    inventory.removeFromSlot(i);
                    onInventoryChange();
                  }
                }}`;
const to=`                onClick={() => {
                  if (!item) return;
                  const recipe = findSmeltingResult(item.id);
                  const canSmelt = !!recipe && isFurnaceRecipeAllowed(containerType, item.id, recipe.output);
                  const isFuel = isSmeltingFuel(item.id);
                  const target = i < 9
                    ? getFurnaceQuickMoveTarget('player_hotbar', { canSmelt, isFuel })
                    : getFurnaceQuickMoveTarget('player_main', { canSmelt, isFuel });

                  setHoveredSlot(null);

                  const removeMoved = (count: number) => {
                    item.count -= count;
                    if (item.count <= 0) inventory.setSlot(i, null);
                  };

                  if (target === 'input') {
                    const max = ItemRegistry.getMaxStackSize(item.id);
                    if (!inputSlot) {
                      const moveCount = Math.min(item.count, max);
                      setInputSlot({ ...item, count: moveCount });
                      removeMoved(moveCount);
                      onInventoryChange();
                    } else if (inputSlot.id === item.id && inputSlot.count < max) {
                      const moveCount = Math.min(item.count, max - inputSlot.count);
                      if (moveCount > 0) {
                        setInputSlot({ ...inputSlot, count: inputSlot.count + moveCount });
                        removeMoved(moveCount);
                        onInventoryChange();
                      }
                    }
                    return;
                  }

                  if (target === 'fuel') {
                    const max = ItemRegistry.getMaxStackSize(item.id);
                    if (!fuelSlot) {
                      const moveCount = Math.min(item.count, max);
                      setFuelSlot({ ...item, count: moveCount });
                      removeMoved(moveCount);
                      onInventoryChange();
                    } else if (fuelSlot.id === item.id && fuelSlot.count < max) {
                      const moveCount = Math.min(item.count, max - fuelSlot.count);
                      if (moveCount > 0) {
                        setFuelSlot({ ...fuelSlot, count: fuelSlot.count + moveCount });
                        removeMoved(moveCount);
                        onInventoryChange();
                      }
                    }
                    return;
                  }

                  inventory.quickMove(i);
                  onInventoryChange();
                }}`;
if(!s.includes(from))throw new Error('missing quick-move anchor');
s=s.replace(from,to);
fs.writeFileSync(p,s);
console.log('patched FurnaceUI quick move 391-410');
