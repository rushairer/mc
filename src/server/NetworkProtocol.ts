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
  /** Server-authoritative sign text editing. */
  C2S_SIGN_UPDATE = 'C2S_SIGN_UPDATE',
  C2S_INTERACT_ENTITY = 'C2S_INTERACT_ENTITY',
  /** P5.1 — server-authoritative item actions (bow release, throwables). */
  C2S_ITEM_ACTION = 'C2S_ITEM_ACTION',
  /** Server-authoritative targeted item use (buckets, ignition, shears, vehicles). */
  C2S_ITEM_USE = 'C2S_ITEM_USE',
  /** Server-timed archaeology brushing session. */
  C2S_BRUSH_ACTION = 'C2S_BRUSH_ACTION',
  /** Server-authoritative Bundle inventory/use transaction. */
  C2S_BUNDLE_ACTION = 'C2S_BUNDLE_ACTION',
  /** Server-authoritative Boat / Chest Boat interaction and controls. */
  C2S_VEHICLE_INTERACT = 'C2S_VEHICLE_INTERACT',
  C2S_VEHICLE_INPUT = 'C2S_VEHICLE_INPUT',
  /** Server-authoritative Horse / Pig mounting and steering. */
  C2S_MOB_INTERACT = 'C2S_MOB_INTERACT',
  C2S_MOB_INPUT = 'C2S_MOB_INPUT',
  /** Server-authoritative fishing cast/reel intent. */
  C2S_FISHING_ACTION = 'C2S_FISHING_ACTION',
  /** P5.2 — client uploads player state so server pushes never revert it. */
  C2S_PLAYER_STATE = 'C2S_PLAYER_STATE',
  /** P5.2 — server-validated consumable use (food / potions). */
  C2S_ITEM_CONSUME = 'C2S_ITEM_CONSUME',
  /** P5.3 — container interaction authority (chests, barrels, hoppers...). */
  C2S_CONTAINER_OPEN = 'C2S_CONTAINER_OPEN',
  /** Legacy snapshot packet: retained for compatibility but never authoritative. */
  C2S_CONTAINER_UPDATE = 'C2S_CONTAINER_UPDATE',
  /** Server-owned cursor transaction: client supplies only area + slot index. */
  C2S_CONTAINER_CLICK = 'C2S_CONTAINER_CLICK',
  /** Close the currently opened server container and reconcile its cursor. */
  C2S_CONTAINER_CLOSE = 'C2S_CONTAINER_CLOSE',

  // Server to Client
  S2C_JOIN_ACK = 'S2C_JOIN_ACK',
  S2C_CHUNK_DATA = 'S2C_CHUNK_DATA',
  S2C_PLAYER_JOIN = 'S2C_PLAYER_JOIN',
  S2C_PLAYER_LEAVE = 'S2C_PLAYER_LEAVE',
  S2C_PLAYER_MOVE = 'S2C_PLAYER_MOVE',
  /** Rubber-band a local player to the last accepted server position. */
  S2C_POSITION_CORRECTION = 'S2C_POSITION_CORRECTION',
  /** Authoritative combat knockback / external velocity impulse. */
  S2C_PLAYER_VELOCITY = 'S2C_PLAYER_VELOCITY',
  S2C_PLAYER_STATE = 'S2C_PLAYER_STATE',
  /** Local client applies the authoritative Totem activation effects/visuals. */
  S2C_TOTEM_ACTIVATE = 'S2C_TOTEM_ACTIVATE',
  S2C_BLOCK_UPDATE = 'S2C_BLOCK_UPDATE',
  S2C_MOB_SPAWN = 'S2C_MOB_SPAWN',
  S2C_MOB_MOVE = 'S2C_MOB_MOVE',
  S2C_MOB_DESPAWN = 'S2C_MOB_DESPAWN',
  S2C_MOB_STATE = 'S2C_MOB_STATE',
  S2C_MOB_RIDER = 'S2C_MOB_RIDER',
  S2C_DROPPED_ITEM_SPAWN = 'S2C_DROPPED_ITEM_SPAWN',
  S2C_DROPPED_ITEM_MOVE = 'S2C_DROPPED_ITEM_MOVE',
  S2C_DROPPED_ITEM_UPDATE = 'S2C_DROPPED_ITEM_UPDATE',
  S2C_DROPPED_ITEM_DESPAWN = 'S2C_DROPPED_ITEM_DESPAWN',
  S2C_PROJECTILE_SPAWN = 'S2C_PROJECTILE_SPAWN',
  S2C_PROJECTILE_MOVE = 'S2C_PROJECTILE_MOVE',
  S2C_PROJECTILE_DESPAWN = 'S2C_PROJECTILE_DESPAWN',
  /** Server-authoritative Boat / Chest Boat spawn. */
  S2C_VEHICLE_SPAWN = 'S2C_VEHICLE_SPAWN',
  S2C_VEHICLE_UPDATE = 'S2C_VEHICLE_UPDATE',
  S2C_VEHICLE_DESPAWN = 'S2C_VEHICLE_DESPAWN',
  S2C_VEHICLE_RIDER = 'S2C_VEHICLE_RIDER',
  /** Owner-facing authoritative fishing bobber state. */
  S2C_FISHING_STATE = 'S2C_FISHING_STATE',
  S2C_CHAT = 'S2C_CHAT',
  S2C_PARTICLE = 'S2C_PARTICLE',
  S2C_SOUND = 'S2C_SOUND',
  S2C_INVENTORY_SYNC = 'S2C_INVENTORY_SYNC',
  S2C_WEATHER = 'S2C_WEATHER',
  S2C_TIME = 'S2C_TIME',
  S2C_BOSS_BAR = 'S2C_BOSS_BAR',
  /** Server container contents plus server-owned cursor. */
  S2C_CONTAINER_DATA = 'S2C_CONTAINER_DATA'
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