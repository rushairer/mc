import { ItemRegistry } from '../items/ItemRegistry';
import { BlockRegistry } from '../world/BlockRegistry';

export interface CommandContext {
  getPlayerPosition: () => { x: number; y: number; z: number };
  setPlayerPosition: (x: number, y: number, z: number) => void;
  addItem: (id: number, count: number) => void;
  setGameMode: (mode: 'survival' | 'creative') => void;
  setTimeOfDay: (t: number) => void;
  setWeather: (type: 'clear' | 'rain' | 'thunder') => void;
  getGameMode: () => 'survival' | 'creative';
  setGameRule: (name: string, value: boolean) => void;
  getGameRule: (name: string) => boolean;
  setDifficulty: (diff: string) => void;
  getDifficulty: () => string;
}

export interface CommandResult {
  success: boolean;
  message: string;
}

const DAY_TICKS = 24000;
const TIME_PRESETS: Record<string, number> = {
  day: 1000,
  noon: 6000,
  night: 13000,
  midnight: 18000,
  // Keep the existing convenience aliases while mapping them to their real ticks.
  sunset: 12000,
  sunrise: 23000,
};

const BOOLEAN_GAMERULES = [
  'keepInventory',
  'doMobSpawning',
  'doDaylightCycle',
  'doWeatherCycle',
  'fallDamage',
  'fireDamage',
  'drowningDamage',
  'naturalRegeneration',
  'mobGriefing',
] as const;

export class CommandSystem {
  private ctx: CommandContext;
  history: string[] = [];

  constructor(ctx: CommandContext) {
    this.ctx = ctx;
  }

  execute(input: string): CommandResult {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return { success: false, message: 'Commands must start with /' };
    }

    this.history.push(trimmed);
    const parts = trimmed.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'give': return this.cmdGive(args);
      case 'tp': case 'teleport': return this.cmdTp(args);
      case 'gamemode': case 'gm': return this.cmdGamemode(args);
      case 'time': return this.cmdTime(args);
      case 'weather': return this.cmdWeather(args);
      case 'gamerule': return this.cmdGamerule(args);
      case 'difficulty': return this.cmdDifficulty(args);
      case 'help': return this.cmdHelp();
      default:
        return { success: false, message: `Unknown command: ${cmd}` };
    }
  }

  private cmdGive(args: string[]): CommandResult {
    if (args.length < 1) return { success: false, message: 'Usage: /give <itemId|itemName> [count]' };
    const arg0 = args[0];
    let id = parseInt(arg0);
    if (isNaN(id)) {
      const item = ItemRegistry.getByName(arg0) || BlockRegistry.getByName(arg0);
      if (!item) return { success: false, message: `Unknown item: ${arg0}` };
      id = item.id;
    }
    const count = args.length > 1 ? parseInt(args[1]) : 1;
    if (id <= 0) return { success: false, message: 'Invalid item ID' };
    if (isNaN(count) || count <= 0) return { success: false, message: 'Invalid count' };
    this.ctx.addItem(id, count);
    const displayName = ItemRegistry.get(id)?.displayName ?? `item #${id}`;
    return { success: true, message: `Gave ${count}x ${displayName}` };
  }

  private cmdTp(args: string[]): CommandResult {
    if (args.length < 3) return { success: false, message: 'Usage: /tp <x> <y> <z>' };
    const x = parseFloat(args[0]);
    const y = parseFloat(args[1]);
    const z = parseFloat(args[2]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return { success: false, message: 'Invalid coordinates' };
    this.ctx.setPlayerPosition(x, y, z);
    return { success: true, message: `Teleported to ${x}, ${y}, ${z}` };
  }

  private cmdGamemode(args: string[]): CommandResult {
    if (args.length < 1) return { success: false, message: 'Usage: /gamemode <survival|creative>' };
    const mode = args[0].toLowerCase();
    if (mode !== 'survival' && mode !== 'creative') {
      return { success: false, message: 'Invalid mode. Use survival or creative' };
    }
    this.ctx.setGameMode(mode);
    return { success: true, message: `Game mode set to ${mode}` };
  }

  private cmdTime(args: string[]): CommandResult {
    if (args.length < 1) return { success: false, message: 'Usage: /time set <day|night|noon|midnight|ticks>' };

    // Java syntax is `/time set <value>`. Keep the old one-token shorthand as a
    // compatibility path for existing saves/UI while using the same canonical mapping.
    let valueArg: string;
    if (args[0].toLowerCase() === 'set') {
      if (args.length < 2) return { success: false, message: 'Usage: /time set <day|night|noon|midnight|ticks>' };
      valueArg = args[1].toLowerCase();
    } else {
      valueArg = args[0].toLowerCase();
    }

    const presetTicks = TIME_PRESETS[valueArg];
    let ticks: number;
    if (presetTicks !== undefined) {
      ticks = presetTicks;
    } else {
      ticks = Number(valueArg);
      if (!Number.isFinite(ticks) || ticks < 0) {
        return { success: false, message: 'Time must be a non-negative tick value or day/night/noon/midnight' };
      }
      ticks = Math.floor(ticks);
    }

    const normalized = ((ticks % DAY_TICKS) + DAY_TICKS) % DAY_TICKS / DAY_TICKS;
    this.ctx.setTimeOfDay(normalized);
    return { success: true, message: `Time set to ${ticks % DAY_TICKS} ticks` };
  }

  private cmdWeather(args: string[]): CommandResult {
    if (args.length < 1) return { success: false, message: 'Usage: /weather <clear|rain|thunder>' };
    const type = args[0].toLowerCase() as 'clear' | 'rain' | 'thunder';
    if (type !== 'clear' && type !== 'rain' && type !== 'thunder') {
      return { success: false, message: 'Invalid weather. Use clear, rain, or thunder' };
    }
    this.ctx.setWeather(type);
    return { success: true, message: `Weather set to ${type}` };
  }

  private cmdGamerule(args: string[]): CommandResult {
    if (args.length < 1) return { success: false, message: 'Usage: /gamerule <ruleName> [value]' };
    const ruleName = args[0];

    if (!(BOOLEAN_GAMERULES as readonly string[]).includes(ruleName)) {
      return { success: false, message: `Unknown gamerule: ${ruleName}. Valid rules: ${BOOLEAN_GAMERULES.join(', ')}` };
    }

    if (args.length < 2) {
      const val = this.ctx.getGameRule(ruleName);
      return { success: true, message: `Gamerule ${ruleName} is currently: ${val}` };
    }

    const valStr = args[1].toLowerCase();
    if (valStr !== 'true' && valStr !== 'false') {
      return { success: false, message: 'Value must be true or false' };
    }

    const value = valStr === 'true';
    this.ctx.setGameRule(ruleName, value);
    return { success: true, message: `Gamerule ${ruleName} set to ${value}` };
  }

  private cmdDifficulty(args: string[]): CommandResult {
    if (args.length < 1) return { success: false, message: 'Usage: /difficulty <peaceful|easy|normal|hard|0|1|2|3>' };
    let diff = args[0].toLowerCase();

    // Preserve numeric compatibility for the browser clone's existing console.
    if (diff === '0') diff = 'peaceful';
    else if (diff === '1') diff = 'easy';
    else if (diff === '2') diff = 'normal';
    else if (diff === '3') diff = 'hard';

    if (diff !== 'peaceful' && diff !== 'easy' && diff !== 'normal' && diff !== 'hard') {
      return { success: false, message: 'Invalid difficulty. Use peaceful, easy, normal, or hard' };
    }

    this.ctx.setDifficulty(diff);
    return { success: true, message: `Difficulty set to ${diff}` };
  }

  private cmdHelp(): CommandResult {
    return {
      success: true,
      message: '/give <id> [count] | /tp <x> <y> <z> | /gamemode <survival|creative> | /time set <day|night|noon|midnight|ticks> | /weather <clear|rain|thunder> | /gamerule <rule> [true|false] | /difficulty <diff>'
    };
  }
}
