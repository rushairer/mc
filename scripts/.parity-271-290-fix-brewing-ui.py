from pathlib import Path
import subprocess

BASELINE = '1160eb252fc63fab3c237b3e01f16e2f1ba2761d'
path = Path('src/ui/BrewingUI.tsx')
source = subprocess.check_output(
    ['git', 'show', f'{BASELINE}:src/ui/BrewingUI.tsx'],
    text=True,
)

old = """        setIngredient((prev) => prev ? { ...prev, count: prev.count - 1 } : null);
        setFuel((prev) => prev ? { ...prev, count: prev.count - 1 } : null);"""
new = """        setIngredient((prev) => {
          const consumed = BrewingSystem.consumeIngredient(prev);
          if (consumed.returnedContainer) {
            const leftover = inventory.addStack(consumed.returnedContainer);
            if (leftover) setHeldItem((held) => held ?? leftover);
          }
          return consumed.ingredient;
        });
        setFuel((prev) => prev ? { ...prev, count: prev.count - 1 } : null);"""
if source.count(old) != 1:
    raise RuntimeError(f'ingredient consume target count={source.count(old)}')
source = source.replace(old, new, 1)

old_deps = """  }, [canBrew, onInventoryChange, action]);"""
new_deps = """  }, [canBrew, onInventoryChange, action, inventory]);"""
if source.count(old_deps) != 1:
    raise RuntimeError(f'brewing effect dependency target count={source.count(old_deps)}')
source = source.replace(old_deps, new_deps, 1)

path.write_text(source)
print('restored current BrewingUI baseline and applied minimal 26.3 container-return wiring')
