import type { ItemStack } from '../types';

export interface JukeboxSongDefinition {
  songId: string;
  comparatorOutput: number;
  soundEvents: readonly string[];
}

/**
 * Java jukebox comparator outputs. Current discs added after the original 15
 * intentionally reuse signal strengths because a comparator only has 15
 * non-zero levels.
 */
const SONGS: Readonly<Record<string, JukeboxSongDefinition>> = {
  record_13: { songId: '13', comparatorOutput: 1, soundEvents: ['music_disc.13', 'record.13'] },
  music_disc_13: { songId: '13', comparatorOutput: 1, soundEvents: ['music_disc.13', 'record.13'] },
  record_cat: { songId: 'cat', comparatorOutput: 2, soundEvents: ['music_disc.cat', 'record.cat'] },
  music_disc_cat: { songId: 'cat', comparatorOutput: 2, soundEvents: ['music_disc.cat', 'record.cat'] },
  record_blocks: { songId: 'blocks', comparatorOutput: 3, soundEvents: ['music_disc.blocks', 'record.blocks'] },
  music_disc_blocks: { songId: 'blocks', comparatorOutput: 3, soundEvents: ['music_disc.blocks', 'record.blocks'] },
  record_chirp: { songId: 'chirp', comparatorOutput: 4, soundEvents: ['music_disc.chirp', 'record.chirp'] },
  music_disc_chirp: { songId: 'chirp', comparatorOutput: 4, soundEvents: ['music_disc.chirp', 'record.chirp'] },
  record_far: { songId: 'far', comparatorOutput: 5, soundEvents: ['music_disc.far', 'record.far'] },
  music_disc_far: { songId: 'far', comparatorOutput: 5, soundEvents: ['music_disc.far', 'record.far'] },
  record_mall: { songId: 'mall', comparatorOutput: 6, soundEvents: ['music_disc.mall', 'record.mall'] },
  music_disc_mall: { songId: 'mall', comparatorOutput: 6, soundEvents: ['music_disc.mall', 'record.mall'] },
  record_mellohi: { songId: 'mellohi', comparatorOutput: 7, soundEvents: ['music_disc.mellohi', 'record.mellohi'] },
  music_disc_mellohi: { songId: 'mellohi', comparatorOutput: 7, soundEvents: ['music_disc.mellohi', 'record.mellohi'] },
  record_stal: { songId: 'stal', comparatorOutput: 8, soundEvents: ['music_disc.stal', 'record.stal'] },
  music_disc_stal: { songId: 'stal', comparatorOutput: 8, soundEvents: ['music_disc.stal', 'record.stal'] },
  music_disc_bounce: { songId: 'bounce', comparatorOutput: 8, soundEvents: ['music_disc.bounce', 'record.bounce'] },
  record_strad: { songId: 'strad', comparatorOutput: 9, soundEvents: ['music_disc.strad', 'record.strad'] },
  music_disc_strad: { songId: 'strad', comparatorOutput: 9, soundEvents: ['music_disc.strad', 'record.strad'] },
  music_disc_lava_chicken: { songId: 'lava_chicken', comparatorOutput: 9, soundEvents: ['music_disc.lava_chicken', 'record.lava_chicken'] },
  record_ward: { songId: 'ward', comparatorOutput: 10, soundEvents: ['music_disc.ward', 'record.ward'] },
  music_disc_ward: { songId: 'ward', comparatorOutput: 10, soundEvents: ['music_disc.ward', 'record.ward'] },
  music_disc_tears: { songId: 'tears', comparatorOutput: 10, soundEvents: ['music_disc.tears', 'record.tears'] },
  record_11: { songId: '11', comparatorOutput: 11, soundEvents: ['music_disc.11', 'record.11'] },
  music_disc_11: { songId: '11', comparatorOutput: 11, soundEvents: ['music_disc.11', 'record.11'] },
  music_disc_creator_music_box: { songId: 'creator_music_box', comparatorOutput: 11, soundEvents: ['music_disc.creator_music_box', 'record.creator_music_box'] },
  record_wait: { songId: 'wait', comparatorOutput: 12, soundEvents: ['music_disc.wait', 'record.wait'] },
  music_disc_wait: { songId: 'wait', comparatorOutput: 12, soundEvents: ['music_disc.wait', 'record.wait'] },
  music_disc_creator: { songId: 'creator', comparatorOutput: 12, soundEvents: ['music_disc.creator', 'record.creator'] },
  music_disc_pigstep: { songId: 'pigstep', comparatorOutput: 13, soundEvents: ['music_disc.pigstep', 'record.pigstep'] },
  music_disc_precipice: { songId: 'precipice', comparatorOutput: 13, soundEvents: ['music_disc.precipice', 'record.precipice'] },
  music_disc_otherside: { songId: 'otherside', comparatorOutput: 14, soundEvents: ['music_disc.otherside', 'record.otherside'] },
  music_disc_relic: { songId: 'relic', comparatorOutput: 14, soundEvents: ['music_disc.relic', 'record.relic'] },
  music_disc_5: { songId: '5', comparatorOutput: 15, soundEvents: ['music_disc.5', 'record.5'] },
};

const normalize = (name: string | undefined) => name?.replace(/^minecraft:/, '').toLowerCase();

export function getJukeboxSong(name: string | undefined): JukeboxSongDefinition | null {
  const normalized = normalize(name);
  return normalized ? SONGS[normalized] ?? null : null;
}

export function isJukeboxPlayableItemName(name: string | undefined): boolean {
  return getJukeboxSong(name) !== null;
}

export function getJukeboxComparatorOutput(name: string | undefined): number {
  return getJukeboxSong(name)?.comparatorOutput ?? 0;
}

export function getStoredJukeboxDisc(stack: ItemStack | null | undefined): ItemStack | null {
  if (!stack) return null;
  return { ...stack, count: 1 };
}
