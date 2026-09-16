import type { PotionEffectData, PotionEffectId } from '../systems/PotionEffect';

export interface SuspiciousStewEffect26_3 extends PotionEffectData {
  sourceFlower: string;
}

const EFFECTS: Record<string, { id: PotionEffectId; duration: number }> = {
  allium: { id: 'fire_resistance', duration: 3 },
  azure_bluet: { id: 'blindness', duration: 11 },
  open_eyeblossom: { id: 'blindness', duration: 11 },
  blue_orchid: { id: 'saturation', duration: 0.35 },
  dandelion: { id: 'saturation', duration: 0.35 },
  yellow_flower: { id: 'saturation', duration: 0.35 },
  golden_dandelion: { id: 'saturation', duration: 0.35 },
  closed_eyeblossom: { id: 'nausea', duration: 7 },
  cornflower: { id: 'jump_boost', duration: 5 },
  lily_of_the_valley: { id: 'poison', duration: 11 },
  oxeye_daisy: { id: 'regeneration', duration: 7 },
  poppy: { id: 'night_vision', duration: 5 },
  red_flower: { id: 'night_vision', duration: 5 },
  torchflower: { id: 'night_vision', duration: 5 },
  red_tulip: { id: 'weakness', duration: 7 },
  orange_tulip: { id: 'weakness', duration: 7 },
  white_tulip: { id: 'weakness', duration: 7 },
  pink_tulip: { id: 'weakness', duration: 7 },
  wither_rose: { id: 'wither', duration: 7 },
};

export function getSuspiciousStewEffect26_3(flowerName: string): SuspiciousStewEffect26_3 | null {
  const effect = EFFECTS[flowerName];
  return effect ? { ...effect, level: 1, sourceFlower: flowerName } : null;
}

/** Saturation stew applies seven Java game ticks of +1 food/+2 saturation. */
export function applySaturationStew26_3(hunger: number, saturation: number): { hunger: number; saturation: number } {
  const nextHunger = Math.min(20, hunger + 7);
  return { hunger: nextHunger, saturation: Math.min(nextHunger, saturation + 14) };
}
