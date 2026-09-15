/** Java Edition 1.20.1 armor toughness contributed by one equipped piece. */
export function getArmorToughness(itemName: string | undefined): number {
  if (!itemName) return 0;
  if (itemName.startsWith('netherite_')) return 3;
  if (itemName.startsWith('diamond_')) return 2;
  return 0;
}
