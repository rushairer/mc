import { SoundSystem } from './SoundSystem';

export interface Advancement {
  id: string;
  title: string;
  description: string;
  icon: number; // Item/Block ID to use as icon
  parent?: string;
}

export const ADVANCEMENTS: Record<string, Advancement> = {
  getting_wood: {
    id: 'getting_wood',
    title: 'Getting Wood',
    description: 'Attack a tree until a block of wood pops out',
    icon: 17, // Oak Log
  },
  stone_age: {
    id: 'stone_age',
    title: 'Stone Age',
    description: 'Mine stone with your new pickaxe',
    icon: 4, // Cobblestone
    parent: 'getting_wood',
  },
  acquire_hardware: {
    id: 'acquire_hardware',
    title: 'Acquire Hardware',
    description: 'Smelt an iron ingot',
    icon: 265, // Iron Ingot
    parent: 'stone_age',
  },
  sweet_dreams: {
    id: 'sweet_dreams',
    title: 'Sweet Dreams',
    description: 'Sleep in a bed to change your respawn point',
    icon: 355, // Bed
    parent: 'getting_wood',
  },
  enchanter: {
    id: 'enchanter',
    title: 'Enchanter',
    description: 'Enchant an item at an Enchanting Table',
    icon: 116, // Enchanting Table
    parent: 'stone_age',
  },
  brew_potion: {
    id: 'brew_potion',
    title: 'Local Brewery',
    description: 'Brew a potion',
    icon: 379, // Brewing Stand
    parent: 'acquire_hardware',
  },
  into_nether: {
    id: 'into_nether',
    title: 'We Need to Go Deeper',
    description: 'Build, light and enter a Nether Portal',
    icon: 87, // Netherrack
    parent: 'acquire_hardware',
  },
  into_end: {
    id: 'into_end',
    title: 'The End?',
    description: 'Enter the End Portal',
    icon: 121, // End Stone
    parent: 'into_nether',
  },
  kill_dragon: {
    id: 'kill_dragon',
    title: 'Free the End',
    description: 'Defeat the Ender Dragon',
    icon: 381, // Ender Eye
    parent: 'into_end',
  },
  kill_wither: {
    id: 'kill_wither',
    title: 'The Beginning.',
    description: 'Spawn and defeat the Wither',
    icon: 399, // Nether Star
    parent: 'into_nether',
  },
};

export class AdvancementSystem {
  private unlocked: Set<string> = new Set();
  private sound: SoundSystem | null = null;
  private onUnlockCallback: ((adv: Advancement) => void) | null = null;

  constructor(sound?: SoundSystem) {
    if (sound) this.sound = sound;
  }

  setOnUnlock(callback: (adv: Advancement) => void) {
    this.onUnlockCallback = callback;
  }

  isUnlocked(id: string): boolean {
    return this.unlocked.has(id);
  }

  getUnlockedList(): string[] {
    return Array.from(this.unlocked);
  }

  unlock(id: string): boolean {
    if (!ADVANCEMENTS[id]) return false;
    if (this.unlocked.has(id)) return false;

    this.unlocked.add(id);
    if (this.sound) {
      if (typeof (this.sound as any).playAdvancement === 'function') {
        (this.sound as any).playAdvancement();
      } else {
        this.sound.playXP(); // fallback
      }
    }

    if (this.onUnlockCallback) {
      this.onUnlockCallback(ADVANCEMENTS[id]);
    }
    return true;
  }

  checkBlockBreak(blockName: string, heldItemName?: string) {
    const normName = blockName.toLowerCase();
    
    // Getting Wood: mine log/wood
    if (normName.includes('log') || normName.includes('wood')) {
      this.unlock('getting_wood');
    }

    // Stone Age: mine stone/cobblestone with pickaxe
    if ((normName.includes('stone') || normName.includes('cobblestone')) && heldItemName?.includes('pickaxe')) {
      this.unlock('stone_age');
    }
  }

  checkInventory(slots: (any | null)[], armor: (any | null)[]) {
    // Check if player has iron ingot for Acquire Hardware
    for (const slot of slots) {
      if (slot && slot.id === 265) { // Iron Ingot
        this.unlock('acquire_hardware');
      }
    }
  }

  checkDimensionChange(dimension: number) {
    if (dimension === 1) { // Nether
      this.unlock('into_nether');
    } else if (dimension === 2) { // End
      this.unlock('into_end');
    }
  }

  checkMobKilled(mobType: string) {
    if (mobType === 'wither') {
      this.unlock('kill_wither');
    }
  }

  checkEnderDragonDefeated() {
    this.unlock('kill_dragon');
  }

  checkSleep() {
    this.unlock('sweet_dreams');
  }

  checkEnchant() {
    this.unlock('enchanter');
  }

  checkBrew() {
    this.unlock('brew_potion');
  }

  reset() {
    this.unlocked.clear();
  }

  load(list?: string[]) {
    this.unlocked.clear();
    if (list) {
      for (const id of list) {
        this.unlocked.add(id);
      }
    }
  }
}
