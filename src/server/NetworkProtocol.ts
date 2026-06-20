import type { ItemStack } from '../types';

export enum PacketType {
  // Client to Server
  C2S_JOIN = 'C2S_JOIN',
  C2S_PLAYER_MOVE = 'C2S_PLAYER_MOVE',
  C2S_BLOCK_BREAK = 'C2S_BLOCK_BREAK',
  C2S_BLOCK_PLACE = 'C2S_BLOCK_PLACE',
  C2S_CHAT = 'C2S_CHAT',
  C2S_INVENTORY_CLICK = 'C2S_INVENTORY_CLICK',
  C2S_HELD_ITEM_CHANGE = 'C2S_HELD_ITEM_CHANGE',
  C2S_CHUNK_REQUEST = 'C2S_CHUNK_REQUEST',
  C2S_INTERACT_BLOCK = 'C2S_INTERACT_BLOCK',
  C2S_INTERACT_ENTITY = 'C2S_INTERACT_ENTITY',

  // Server to Client
  S2C_JOIN_ACK = 'S2C_JOIN_ACK',
  S2C_CHUNK_DATA = 'S2C_CHUNK_DATA',
  S2C_PLAYER_JOIN = 'S2C_PLAYER_JOIN',
  S2C_PLAYER_LEAVE = 'S2C_PLAYER_LEAVE',
  S2C_PLAYER_MOVE = 'S2C_PLAYER_MOVE',
  S2C_PLAYER_STATE = 'S2C_PLAYER_STATE',
  S2C_BLOCK_UPDATE = 'S2C_BLOCK_UPDATE',
  S2C_MOB_SPAWN = 'S2C_MOB_SPAWN',
  S2C_MOB_MOVE = 'S2C_MOB_MOVE',
  S2C_MOB_DESPAWN = 'S2C_MOB_DESPAWN',
  S2C_MOB_STATE = 'S2C_MOB_STATE',
  S2C_DROPPED_ITEM_SPAWN = 'S2C_DROPPED_ITEM_SPAWN',
  S2C_DROPPED_ITEM_MOVE = 'S2C_DROPPED_ITEM_MOVE',
  S2C_DROPPED_ITEM_DESPAWN = 'S2C_DROPPED_ITEM_DESPAWN',
  S2C_PROJECTILE_SPAWN = 'S2C_PROJECTILE_SPAWN',
  S2C_PROJECTILE_MOVE = 'S2C_PROJECTILE_MOVE',
  S2C_PROJECTILE_DESPAWN = 'S2C_PROJECTILE_DESPAWN',
  S2C_CHAT = 'S2C_CHAT',
  S2C_PARTICLE = 'S2C_PARTICLE',
  S2C_SOUND = 'S2C_SOUND',
  S2C_INVENTORY_SYNC = 'S2C_INVENTORY_SYNC',
  S2C_WEATHER = 'S2C_WEATHER',
  S2C_TIME = 'S2C_TIME',
  S2C_BOSS_BAR = 'S2C_BOSS_BAR'
}

export interface Packet {
  type: PacketType;
  payload: any;
}

/**
 * Compresses an array of block IDs using Run-Length Encoding (RLE)
 */
export function compressBlocks(blocks: Uint16Array | number[]): number[] {
  const rle: number[] = [];
  if (blocks.length === 0) return rle;
  let currentId = blocks[0];
  let count = 1;
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i] === currentId) {
      count++;
    } else {
      rle.push(currentId, count);
      currentId = blocks[i];
      count = 1;
    }
  }
  rle.push(currentId, count);
  return rle;
}

/**
 * Decompress an RLE compressed block array
 */
export function decompressBlocks(rle: number[], targetLength: number): Uint16Array {
  const blocks = new Uint16Array(targetLength);
  let index = 0;
  for (let i = 0; i < rle.length; i += 2) {
    const id = rle[i];
    const count = rle[i + 1];
    for (let c = 0; c < count; c++) {
      if (index < targetLength) {
        blocks[index++] = id;
      }
    }
  }
  return blocks;
}
