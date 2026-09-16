import fs from 'node:fs';
const p='src/engine/Game.ts';
let s=fs.readFileSync(p,'utf8');
const r=(a,b,n)=>{if(!s.includes(a))throw new Error('missing '+n);s=s.replace(a,b)};
r("import { canAcceptFurnaceOutput, getFurnaceCookSpeed, getWetSpongeFuelRemainder } from '../world/FurnaceRules';","import { canAcceptFurnaceOutput, getFurnaceCookSpeed, getFurnaceFuelBurnTime, getFurnaceFuelRemainder, getWetSpongeFuelRemainder, isFurnaceRecipeAllowed } from '../world/FurnaceRules';",'import');
r(`    if (hasRecipe && input) {
      let typeValid = true;
      const itemDef = ItemRegistry.get(input.id);
      if (itemDef) {
        if (meta.containerType === 'smoker') {
          typeValid = ItemRegistry.isFood(input.id) || ItemRegistry.isFood(hasRecipe.output);
        } else if (meta.containerType === 'blast_furnace') {
          typeValid = (itemDef.name.includes('ore') || itemDef.name.startsWith('raw_')) && !ItemRegistry.isFood(input.id);
        }
      } else {
        typeValid = false;
      }

      if (typeValid) {`,`    if (hasRecipe && input) {
      const typeValid = isFurnaceRecipeAllowed(meta.containerType, input.id, hasRecipe.output);

      if (typeValid) {`,'recipe gate');
r(`      const fuelBurnTime = getFuelBurnTime(fuel.id);
      if (fuelBurnTime > 0) {
        meta.burnTime = fuelBurnTime;
        meta.maxBurnTime = fuelBurnTime;

        const baseFuelId = fuel.id & 0x3FF;
        if (baseFuelId === 327) { // Lava bucket -> empty bucket
          meta.inventory[1] = { id: 325, count: 1 };
        } else {
          fuel.count--;
          if (fuel.count <= 0) {
            meta.inventory[1] = null;
          }
        }
        metadataChanged = true;
      }`,`      const fuelBurnTime = getFurnaceFuelBurnTime(meta.containerType, getFuelBurnTime(fuel.id));
      if (fuelBurnTime > 0) {
        meta.burnTime = fuelBurnTime;
        meta.maxBurnTime = fuelBurnTime;
        const fuelRemainder = getFurnaceFuelRemainder(fuel);
        if (fuelRemainder) meta.inventory[1] = fuelRemainder;
        else {
          fuel.count--;
          if (fuel.count <= 0) meta.inventory[1] = null;
        }
        metadataChanged = true;
      }`,'fuel');
r("        const wetSpongeRemainder = getWetSpongeFuelRemainder(ItemRegistry.get(input.id)?.name, meta.inventory[1]);","        const wetSpongeRemainder = getWetSpongeFuelRemainder(ItemRegistry.get(input.id)?.name ?? BlockRegistry.get(input.id)?.name, meta.inventory[1]);",'wet sponge');
fs.writeFileSync(p,s);
console.log('patched Game 391-410');
