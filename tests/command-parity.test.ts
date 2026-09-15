import assert from 'node:assert/strict';
import test from 'node:test';
import { CommandSystem, type CommandContext } from '../src/systems/CommandSystem';

function makeContext() {
  let time = -1;
  const rules = new Map<string, boolean>();
  const ctx: CommandContext = {
    getPlayerPosition: () => ({ x: 0, y: 64, z: 0 }),
    setPlayerPosition: () => {},
    addItem: () => {},
    setGameMode: () => {},
    setTimeOfDay: (value) => { time = value; },
    setWeather: () => {},
    getGameMode: () => 'survival',
    setGameRule: (name, value) => { rules.set(name, value); },
    getGameRule: (name) => rules.get(name) ?? true,
    setDifficulty: () => {},
    getDifficulty: () => 'normal',
  };
  return { ctx, getTime: () => time, rules };
}

test('time set presets map to Java tick values', () => {
  const { ctx, getTime } = makeContext();
  const commands = new CommandSystem(ctx);

  assert.equal(commands.execute('/time set day').success, true);
  assert.ok(Math.abs(getTime() - 1000 / 24000) < 1e-12);
  commands.execute('/time set noon');
  assert.equal(getTime(), 6000 / 24000);
  commands.execute('/time set night');
  assert.equal(getTime(), 13000 / 24000);
  commands.execute('/time set midnight');
  assert.equal(getTime(), 18000 / 24000);
});

test('time set numeric values wrap within the 24000 tick day', () => {
  const { ctx, getTime } = makeContext();
  const commands = new CommandSystem(ctx);
  assert.equal(commands.execute('/time set 25000').success, true);
  assert.ok(Math.abs(getTime() - 1000 / 24000) < 1e-12);
});

test('new survival gamerules are queryable and writable from the command system', () => {
  const { ctx, rules } = makeContext();
  const commands = new CommandSystem(ctx);

  assert.equal(commands.execute('/gamerule naturalRegeneration false').success, true);
  assert.equal(commands.execute('/gamerule drowningDamage false').success, true);
  assert.equal(rules.get('naturalRegeneration'), false);
  assert.equal(rules.get('drowningDamage'), false);
  assert.equal(commands.execute('/gamerule naturalRegeneration').success, true);
});
