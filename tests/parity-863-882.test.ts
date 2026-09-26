import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ItemRegistry } from '../src/items/ItemRegistry';
import {
  activateDispenserLike,
  collectableFluidBucketName,
  consumeDispenserSlot,
  damageDispenserTool,
  getDispenserSpecialAction,
  isDispenserFluidPlacementReplaceable,
  replaceOneDispenserItem,
} from '../src/items/DispenserRules';
import type { ItemStack } from '../src/types';

const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};

test('863: all three Java arrow families use the Dispenser arrow projectile path', () => {
  for (const name of ['arrow', 'spectral_arrow', 'tipped_arrow']) {
    assert.deepEqual(getDispenserSpecialAction(name), { kind: 'projectile', projectile: 'arrow' });
  }
});

test('864: Snowball and Egg use throwable projectile behavior instead of item ejection', () => {
  assert.deepEqual(getDispenserSpecialAction('snowball'), { kind: 'projectile', projectile: 'snowball' });
  assert.deepEqual(getDispenserSpecialAction('egg'), { kind: 'projectile', projectile: 'egg' });
});

test('865: Bottle o Enchanting is launched as an experience projectile', () => {
  assert.deepEqual(getDispenserSpecialAction('experience_bottle'), { kind: 'projectile', projectile: 'experience_bottle' });
});

test('866: only splash and lingering potions use potion projectile behavior', () => {
  assert.deepEqual(getDispenserSpecialAction('splash_potion'), { kind: 'projectile', projectile: 'potion', potionVariant: 'splash' });
  assert.deepEqual(getDispenserSpecialAction('lingering_potion'), { kind: 'projectile', projectile: 'potion', potionVariant: 'lingering' });
  assert.equal(getDispenserSpecialAction('potion'), null);
});

test('867: both legacy and modern Firework Rocket identities launch as fireworks', () => {
  assert.deepEqual(getDispenserSpecialAction('fireworks'), { kind: 'projectile', projectile: 'firework_rocket' });
  assert.deepEqual(getDispenserSpecialAction('firework_rocket'), { kind: 'projectile', projectile: 'firework_rocket' });
});

test('868: Fire Charge launches the existing fireball projectile', () => {
  assert.deepEqual(getDispenserSpecialAction('fire_charge'), { kind: 'projectile', projectile: 'fireball' });
});

test('869: Wind Charge launches through the existing wind-charge projectile system', () => {
  assert.deepEqual(getDispenserSpecialAction('wind_charge'), { kind: 'projectile', projectile: 'wind_charge' });
});

test('870: TNT is classified as primed TNT rather than a dropped block item', () => {
  assert.deepEqual(getDispenserSpecialAction('tnt'), { kind: 'prime_tnt' });
});

test('871: Flint and Steel is a durable Dispenser ignition tool', () => {
  assert.deepEqual(getDispenserSpecialAction('flint_and_steel'), { kind: 'ignite' });
  const flint = item('flint_and_steel');
  assert.equal(flint.category, 'tool');
  assert.equal(flint.durability, 64);
});

test('872: Water, Lava and Powder Snow buckets map to their placeable contents', () => {
  assert.deepEqual(getDispenserSpecialAction('water_bucket'), { kind: 'place_fluid', blockName: 'water' });
  assert.deepEqual(getDispenserSpecialAction('lava_bucket'), { kind: 'place_fluid', blockName: 'lava' });
  assert.deepEqual(getDispenserSpecialAction('powder_snow_bucket'), { kind: 'place_fluid', blockName: 'powder_snow' });
  assert.deepEqual(getDispenserSpecialAction('bucket'), { kind: 'collect_fluid' });
});

test('873: unsupported items retain the ordinary Dispenser ejection fallback', () => {
  assert.equal(getDispenserSpecialAction('paper'), null);
  const paper = { id: item('paper').id, count: 3 };
  const result = activateDispenserLike('dispenser', [paper], { sourceSlot: 0 });
  assert.equal(result.action, 'eject');
  assert.equal(result.stack?.id, paper.id);
  assert.equal(result.sourceSlots[0]?.count, 2);
});

test('874: a preselected slot prevents special-action fallback from rerolling the source slot', () => {
  const paper = { id: item('paper').id, count: 2 };
  const stone = { id: item('cobblestone').id, count: 2 };
  const result = activateDispenserLike('dispenser', [paper, stone], {
    sourceSlot: 1,
    random: () => 0,
  });
  assert.equal(result.sourceSlot, 1);
  assert.equal(result.stack?.id, stone.id);
  assert.equal(result.sourceSlots[0]?.count, 2);
  assert.equal(result.sourceSlots[1]?.count, 1);
});

test('875: special projectile consumption removes exactly one item and preserves remaining components', () => {
  const stack: ItemStack = {
    id: item('splash_potion').id,
    count: 2,
    customName: 'Healing Trap',
    potion: { kind: 'healing', name: 'Healing', variant: 'splash' },
  };
  const next = consumeDispenserSlot([stack], 0);
  assert.equal(next[0]?.count, 1);
  assert.equal(next[0]?.customName, 'Healing Trap');
  assert.equal(next[0]?.potion?.kind, 'healing');
});

test('876: bucket replacement uses the selected slot directly when it becomes empty', () => {
  const waterBucket = { id: item('water_bucket').id, count: 1 };
  const empty = { id: item('bucket').id, count: 1 };
  const result = replaceOneDispenserItem([waterBucket, null], 0, empty);
  assert.equal(result.overflow, null);
  assert.equal(result.slots[0]?.id, empty.id);
  assert.equal(result.slots[0]?.count, 1);
});

test('877: stacked empty buckets place a filled result into another slot without deleting the remainder', () => {
  const buckets = { id: item('bucket').id, count: 3 };
  const water = { id: item('water_bucket').id, count: 1 };
  const result = replaceOneDispenserItem([buckets, null], 0, water);
  assert.equal(result.slots[0]?.count, 2);
  assert.equal(result.slots[1]?.id, water.id);
  assert.equal(result.overflow, null);
});

test('878: a full machine reports a filled-bucket overflow rather than silently deleting it', () => {
  const buckets = { id: item('bucket').id, count: 2 };
  const filler = { id: item('cobblestone').id, count: 64 };
  const slots = [buckets, ...new Array(8).fill(null).map(() => ({ ...filler }))];
  const filled = { id: item('lava_bucket').id, count: 1 };
  const result = replaceOneDispenserItem(slots, 0, filled);
  assert.equal(result.slots[0]?.count, 1);
  assert.equal(result.overflow?.id, filled.id);
});

test('879: Flint and Steel loses one durability on successful Dispenser use and eventually breaks', () => {
  const flint = { id: item('flint_and_steel').id, count: 1, durability: 2 };
  const once = damageDispenserTool([flint], 0, 64);
  assert.equal(once[0]?.durability, 1);
  const broken = damageDispenserTool(once, 0, 64);
  assert.equal(broken[0], null);
});

test('880: empty buckets collect only stationary Water/Lava source identities plus Powder Snow', () => {
  assert.equal(collectableFluidBucketName('water'), 'water_bucket');
  assert.equal(collectableFluidBucketName('lava'), 'lava_bucket');
  assert.equal(collectableFluidBucketName('powder_snow'), 'powder_snow_bucket');
  assert.equal(collectableFluidBucketName('flowing_water'), null);
  assert.equal(collectableFluidBucketName('flowing_lava'), null);
  assert.equal(isDispenserFluidPlacementReplaceable('air'), true);
  assert.equal(isDispenserFluidPlacementReplaceable('stone'), false);
});

test('881: Dispenser projectile execution uses the real projectile systems and neutral hit override', () => {
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const projectile = readFileSync(new URL('../src/systems/ProjectileSystem.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('this.projectiles.shootArrow(origin, direction, true)'));
  assert.ok(game.includes('this.projectiles.shootThrowable(special.projectile, origin, direction, true)'));
  assert.ok(game.includes('this.projectiles.shootExperienceBottle(origin, direction, true)'));
  assert.ok(game.includes('this.projectiles.shootPotion('));
  assert.ok(game.includes('this.projectiles.shootFireworkRocket(origin, direction, true)'));
  assert.ok(game.includes('this.projectiles.shootFireball(origin, direction, true, 4)'));
  assert.ok(game.includes('this.projectiles.shootWindCharge(origin, direction, true, 1)'));
  assert.ok(game.includes('projectile.hitsPlayers = true'));
  assert.ok(projectile.includes('(proj.hitsPlayers ?? !proj.fromPlayer)'));
});

test('882: TNT, ignition and buckets mutate the world through existing fuse/fire/fluid systems', () => {
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = game.indexOf('private tryActivateSpecialDispenserItem');
  assert.ok(start >= 0);
  const method = game.slice(start, start + 9000);
  assert.ok(method.includes('timer: 4.0'));
  assert.ok(method.includes('this.igniteTNT(tx, ty, tz)'));
  assert.ok(method.includes("BlockRegistry.getByName('fire')"));
  assert.ok(method.includes('damageDispenserTool(meta.inventory, sourceSlot, 64)'));
  assert.ok(method.includes('this.scheduleFluidNeighborhood(tx, ty, tz)'));
  assert.ok(method.includes('replaceOneDispenserItem(meta.inventory, sourceSlot'));
  assert.ok(method.includes('this.chunks.setBlock(tx, ty, tz, 0)'));
});
