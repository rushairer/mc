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
}

export interface CommandResult {
  success: boolean;
  message: string;
}

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
    if (args.length < 1) return { success: false, message: 'Usage: /time <day|night|noon|midnight|0-1>' };
    const val = args[0].toLowerCase();
    let t: number;
    switch (val) {
      case 'day': t = 0.25; break;
      case 'night': case 'midnight': t = 0.75; break;
      case 'noon': t = 0.25; break;
      case 'sunrise': t = 0; break;
      case 'sunset': t = 0.5; break;
      default:
        t = parseFloat(val);
        if (isNaN(t) || t < 0 || t > 1) return { success: false, message: 'Time must be 0-1 or day/night/noon/midnight' };
    }
    this.ctx.setTimeOfDay(t);
    return { success: true, message: `Time set to ${t}` };
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

  private cmdHelp(): CommandResult {
    return {
      success: true,
      message: '/give <id> [count] | /tp <x> <y> <z> | /gamemode <survival|creative> | /time <day|night> | /weather <clear|rain|thunder>'
    };
  }
}
