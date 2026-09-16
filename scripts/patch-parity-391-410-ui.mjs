import fs from 'node:fs';
const p='src/ui/FurnaceUI.tsx';
let s=fs.readFileSync(p,'utf8');
const r=(a,b,n)=>{if(!s.includes(a))throw new Error('missing '+n);s=s.replace(a,b)};
r("import React, { useState, useCallback, useEffect } from 'react';","import React, { useState, useCallback, useEffect, useMemo } from 'react';",'react import');
r("import { useI18n } from '../i18n';","import { useI18n } from '../i18n';\nimport { getFurnaceQuickMoveTarget, isFurnaceRecipeAllowed } from '../world/FurnaceRules';",'rules import');
r(`  const [outputSlot, setOutputSlot] = useState<ItemStack | null>(furnaceSlots[2]);
  const [recipeListOpen, setRecipeListOpen] = useState(false);`,`  const [outputSlot, setOutputSlot] = useState<ItemStack | null>(furnaceSlots[2]);
  const [recipeListOpen, setRecipeListOpen] = useState(false);
  const availableRecipes = useMemo(
    () => SMELTING_RECIPES.filter((entry) => isFurnaceRecipeAllowed(containerType, entry.input, entry.output)),
    [containerType],
  );`,'recipe memo');
r(`  const handleRecipeSelect = useCallback((inputId: number) => {
    if (inputSlot) {`,`  const handleRecipeSelect = useCallback((inputId: number) => {
    const selectedRecipe = findSmeltingResult(inputId);
    if (!selectedRecipe || !isFurnaceRecipeAllowed(containerType, inputId, selectedRecipe.output)) return;
    if (inputSlot) {`,'recipe guard');
r(`      const exact = item.id === inputId;
      const baseMatch = (item.id & 0x3FF) === (inputId & 0x3FF);
      if (!exact && !baseMatch) continue;`,`      if (item.id !== inputId) continue;`,'modern id');
r("  }, [inputSlot, inventory, onInventoryChange]);","  }, [containerType, inputSlot, inventory, onInventoryChange]);",'deps');
r(`  const inputItem = furnaceSlots[0];
  const recipe = inputItem ? findSmeltingResult(inputItem.id) : null;
  const totalCookTime = recipe ? recipe.cookTime : 10;`,`  const inputItem = furnaceSlots[0];
  const candidateRecipe = inputItem ? findSmeltingResult(inputItem.id) : null;
  const recipe = candidateRecipe && inputItem && isFurnaceRecipeAllowed(containerType, inputItem.id, candidateRecipe.output)
    ? candidateRecipe
    : null;
  const totalCookTime = recipe ? recipe.cookTime : 10;`,'progress gate');
r("{t('recipeBook')} ({SMELTING_RECIPES.length})","{t('recipeBook')} ({availableRecipes.length})",'count');
r("{SMELTING_RECIPES.map((recipe, i) => {","{availableRecipes.map((recipe, i) => {",'map');
fs.writeFileSync(p,s);
console.log('patched FurnaceUI core 391-410');
