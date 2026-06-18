import type { Locale } from './i18n';

type Dict = Record<string, string>;

const ZH_CN_EXACT: Dict = {
  Air: '空气',
  Stone: '石头',
  'Grass Block': '草方块',
  Dirt: '泥土',
  Cobblestone: '圆石',
  'Wooden Planks': '木板',
  'Wood Planks': '木板',
  Sapling: '树苗',
  Bedrock: '基岩',
  Sand: '沙子',
  Gravel: '沙砾',
  Wood: '原木',
  Leaves: '树叶',
  Sponge: '海绵',
  Glass: '玻璃',
  Dispenser: '发射器',
  'Note Block': '音符盒',
  'Sticky Piston': '黏性活塞',
  Cobweb: '蜘蛛网',
  Grass: '草',
  'Dead Bush': '枯死的灌木',
  Piston: '活塞',
  Wool: '羊毛',
  Dandelion: '蒲公英',
  Poppy: '虞美人',
  TNT: 'TNT',
  Bookshelf: '书架',
  'Moss Stone': '苔石',
  Obsidian: '黑曜石',
  Torch: '火把',
  Chest: '箱子',
  'Crafting Table': '工作台',
  Farmland: '耕地',
  Furnace: '熔炉',
  Ladder: '梯子',
  Rail: '铁轨',
  Lever: '拉杆',
  Ice: '冰',
  Cactus: '仙人掌',
  Clay: '黏土',
  Jukebox: '唱片机',
  Pumpkin: '南瓜',
  Netherrack: '下界岩',
  'Soul Sand': '灵魂沙',
  Glowstone: '荧石',
  'Jack o\'Lantern': '南瓜灯',
  Mycelium: '菌丝',
  'Lily Pad': '睡莲',
  'End Stone': '末地石',
  'Dragon Egg': '龙蛋',
  Beacon: '信标',
  Anvil: '铁砧',
  Hopper: '漏斗',
  Observer: '侦测器',
  Apple: '苹果',
  Bow: '弓',
  Arrow: '箭',
  Coal: '煤炭',
  Charcoal: '木炭',
  Diamond: '钻石',
  Stick: '木棍',
  Bowl: '碗',
  String: '线',
  Feather: '羽毛',
  Gunpowder: '火药',
  Seeds: '种子',
  Wheat: '小麦',
  Bread: '面包',
  Flint: '燧石',
  Painting: '画',
  Sign: '告示牌',
  Bucket: '桶',
  'Water Bucket': '水桶',
  'Water Bottle': '水瓶',
  'Lava Bucket': '岩浆桶',
  Minecart: '矿车',
  Saddle: '鞍',
  Snowball: '雪球',
  Boat: '船',
  Leather: '皮革',
  Milk: '牛奶',
  Paper: '纸',
  Book: '书',
  Slimeball: '黏液球',
  Egg: '鸡蛋',
  Compass: '指南针',
  Clock: '时钟',
  Bone: '骨头',
  Sugar: '糖',
  Cake: '蛋糕',
  Bed: '床',
  Cookie: '曲奇',
  Map: '地图',
  Shears: '剪刀',
  Melon: '西瓜',
  'Raw Beef': '生牛肉',
  Steak: '牛排',
  'Raw Chicken': '生鸡肉',
  'Cooked Chicken': '熟鸡肉',
  'Rotten Flesh': '腐肉',
  'Ender Pearl': '末影珍珠',
  'Blaze Rod': '烈焰棒',
  'Ghast Tear': '恶魂之泪',
  'Nether Wart': '下界疣',
  Potion: '药水',
  'Awkward Potion': '粗制药水',
  'Potion of Healing': '治疗药水',
  'Potion of Regeneration': '再生药水',
  'Potion of Swiftness': '迅捷药水',
  'Potion of Fire Resistance': '抗火药水',
  'Potion of Poison': '剧毒药水',
  'Glass Bottle': '玻璃瓶',
  'Spider Eye': '蜘蛛眼',
  'Fermented Spider Eye': '发酵蛛眼',
  'Blaze Powder': '烈焰粉',
  'Magma Cream': '岩浆膏',
  Cauldron: '炼药锅',
  'Brewing Stand': '酿造台',
  'Eye of Ender': '末影之眼',
  Emerald: '绿宝石',
  Carrot: '胡萝卜',
  Potato: '马铃薯',
  'Baked Potato': '烤马铃薯',
  'Golden Carrot': '金胡萝卜',
  'Pumpkin Pie': '南瓜派',
  Shield: '盾牌',
  Elytra: '鞘翅',
};

const ZH_TW_EXACT: Dict = {
  ...ZH_CN_EXACT,
  Air: '空氣',
  'Grass Block': '草地',
  'Water Bottle': '水瓶',
  'Wood Planks': '木材',
  Cobblestone: '鵝卵石',
  Sapling: '樹苗',
  Bedrock: '基岩',
  Gravel: '礫石',
  Dispenser: '發射器',
  'Sticky Piston': '黏性活塞',
  Dandelion: '蒲公英',
  Poppy: '罌粟',
  'Moss Stone': '青苔石',
  'Jack o\'Lantern': '南瓜燈',
  Mycelium: '菌絲土',
  'Lily Pad': '荷葉',
  Anvil: '鐵砧',
  Observer: '偵測器',
  Coal: '煤炭',
  Charcoal: '木炭',
  String: '線',
  Gunpowder: '火藥',
  Bucket: '桶',
  'Lava Bucket': '熔岩桶',
  Minecart: '礦車',
  Saddle: '鞍',
  Snowball: '雪球',
  Boat: '船',
  Slimeball: '史萊姆球',
  Compass: '指南針',
  Clock: '時鐘',
  Shears: '剪刀',
  'Raw Beef': '生牛肉',
  Steak: '牛排',
  'Rotten Flesh': '腐肉',
  'Ender Pearl': '終界珍珠',
  'Blaze Rod': '烈焰桿',
  'Ghast Tear': '幽靈之淚',
  'Nether Wart': '地獄疙瘩',
  Potion: '藥水',
  'Awkward Potion': '粗製藥水',
  'Potion of Healing': '治療藥水',
  'Potion of Regeneration': '回復藥水',
  'Potion of Swiftness': '迅捷藥水',
  'Potion of Fire Resistance': '抗火藥水',
  'Potion of Poison': '劇毒藥水',
  'Glass Bottle': '玻璃瓶',
  'Spider Eye': '蜘蛛眼',
  'Fermented Spider Eye': '發酵蜘蛛眼',
  'Blaze Powder': '烈焰粉',
  'Magma Cream': '岩漿膏',
  Cauldron: '鍋釜',
  'Brewing Stand': '釀造台',
  'Eye of Ender': '終界之眼',
  Carrot: '胡蘿蔔',
  Potato: '馬鈴薯',
  'Baked Potato': '烤馬鈴薯',
  'Golden Carrot': '金胡蘿蔔',
  Elytra: '鞘翅',
};

const ZH_CN_WORDS: Dict = {
  acacia: '金合欢', activator: '激活', armor: '盔甲', axe: '斧', baked: '烤', banner: '旗帜',
  beetroot: '甜菜', birch: '白桦', black: '黑色', blaze: '烈焰', block: '块', blue: '蓝色',
  bone: '骨', book: '书', boots: '靴子', bottle: '瓶', brick: '砖', brown: '棕色', bucket: '桶',
  button: '按钮', carrot: '胡萝卜', chain: '锁链', chainmail: '链甲', chest: '箱子',
  chestplate: '胸甲', chorus: '紫颂', clay: '黏土', coal: '煤炭', cobblestone: '圆石',
  command: '命令', comparator: '比较器', concrete: '混凝土', cooked: '熟', cyan: '青色',
  dark: '深色', daylight: '阳光', dead: '枯死', detector: '探测', diamond: '钻石', door: '门',
  dragon: '龙', dropper: '投掷器', dust: '粉', dye: '染料', egg: '蛋', emerald: '绿宝石',
  enchanted: '附魔', enchanting: '附魔', end: '末地', ender: '末影', eye: '眼', feather: '羽毛',
  fence: '栅栏', fermented: '发酵', fire: '火焰', firework: '烟花', fish: '鱼', flint: '燧石',
  flower: '花', frame: '框', furnace: '熔炉', gate: '门', ghast: '恶魂', glass: '玻璃',
  glazed: '带釉', glistering: '闪烁', glowstone: '荧石', gold: '金', golden: '金', gray: '灰色',
  green: '绿色', gunpowder: '火药', helmet: '头盔', heavy: '重质', hoe: '锄', horse: '马',
  ingot: '锭', iron: '铁', item: '物品', jungle: '丛林', lapis: '青金石', lazuli: '',
  leather: '皮革', leggings: '护腿', light: '淡', lime: '黄绿色', lingering: '滞留型',
  log: '原木', magenta: '品红色', magma: '岩浆', melon: '西瓜', minecart: '矿车',
  mushroom: '蘑菇', mutton: '羊肉', name: '命名', nether: '下界', nugget: '粒', oak: '橡木',
  observer: '侦测器', orange: '橙色', ore: '矿石', pane: '板', pants: '裤子', pearl: '珍珠',
  pickaxe: '镐', pink: '粉红色', piston: '活塞', planks: '木板', plate: '压力板',
  poisonous: '毒', popped: '爆裂', porkchop: '猪排', pot: '盆', potato: '马铃薯',
  potion: '药水', powder: '粉末', pressure: '压力', prismarine: '海晶', pufferfish: '河豚',
  pumpkin: '南瓜', purple: '紫色', quartz: '石英', rabbit: '兔肉', rail: '铁轨', raw: '生',
  red: '红色', redstone: '红石', repeater: '中继器', rod: '棒', rotten: '腐烂', salmon: '鲑鱼',
  sand: '沙子', sandstone: '砂岩', sapling: '树苗', shard: '碎片', shears: '剪刀',
  shovel: '铲', shulker: '潜影', sign: '告示牌', silver: '淡灰色', skeleton: '骷髅',
  slab: '台阶', slime: '黏液', snow: '雪', spawn: '生成', spectral: '光灵', spider: '蜘蛛',
  splash: '喷溅型', spruce: '云杉', stained: '染色', stairs: '楼梯', star: '星', stick: '木棍',
  stone: '石', string: '线', sugar: '糖', sword: '剑', tear: '泪', tipped: '药箭',
  torch: '火把', trapdoor: '活板门', trapped: '陷阱', tripwire: '绊线', tunic: '外套',
  void: '空位', wart: '疣', water: '水', weighted: '测重', wheat: '小麦', white: '白色',
  wither: '凋灵', wood: '木', wooden: '木', wool: '羊毛', written: '成书', yellow: '黄色',
  zombie: '僵尸',
};

const ZH_TW_WORDS: Dict = {
  ...ZH_CN_WORDS,
  acacia: '相思木', birch: '樺木', black: '黑色', blaze: '烈焰使者', blue: '藍色',
  bone: '骨', boots: '靴子', brick: '磚', brown: '棕色', button: '按鈕', carrot: '胡蘿蔔',
  chestplate: '胸甲', clay: '黏土', cobblestone: '鵝卵石', comparator: '比較器',
  cooked: '熟', cyan: '青色', daylight: '日光', dead: '枯死', diamond: '鑽石',
  dragon: '龍', dropper: '投擲器', dye: '染料', emerald: '綠寶石', enchanted: '附魔',
  enchanting: '附魔', end: '終界', ender: '終界', fermented: '發酵', firework: '煙火',
  flower: '花', frame: '框', ghast: '幽靈', glistering: '鑲金', glowstone: '螢石',
  golden: '金', gray: '灰色', green: '綠色', helmet: '頭盔', heavy: '重質', ingot: '錠',
  item: '物品', jungle: '叢林', lapis: '青金石', leggings: '護腿', light: '淺',
  lime: '淺綠色', lingering: '滯留型', magenta: '洋紅色', minecart: '礦車',
  mutton: '羊肉', name: '命名', nether: '地獄', nugget: '粒', observer: '偵測器',
  orange: '橙色', ore: '礦石', pane: '片', pearl: '珍珠', pickaxe: '鎬',
  pink: '粉紅色', planks: '木材', poisonous: '毒', popped: '爆開', porkchop: '豬排',
  potato: '馬鈴薯', prismarine: '海磷石', pufferfish: '河豚', purple: '紫色',
  rabbit: '兔肉', rail: '鐵軌', red: '紅色', repeater: '中繼器', rod: '桿',
  rotten: '腐肉', salmon: '鮭魚', sapling: '樹苗', shard: '碎片', shovel: '鏟',
  shulker: '界伏', sign: '告示牌', silver: '淺灰色', slime: '史萊姆', spawn: '生成',
  spectral: '光靈', splash: '飛濺型', spruce: '杉木', star: '星', stone: '石頭',
  tipped: '藥水', torch: '火把', trapdoor: '地板門', trapped: '陷阱', tripwire: '絆線',
  wart: '疙瘩', weighted: '測重', white: '白色', wither: '凋零', wooden: '木製',
  yellow: '黃色', zombie: '殭屍',
};

const MATERIAL_SUFFIXES = new Set(['sword', 'shovel', 'pickaxe', 'axe', 'hoe', 'helmet', 'chestplate', 'leggings', 'boots']);

const normalize = (value: string) => value.replace(/^minecraft:/, '').replace(/_/g, ' ').trim();

const titleCaseFromName = (name: string) => normalize(name).replace(/\b\w/g, (c) => c.toUpperCase());

const translateWords = (name: string, words: Dict) => {
  const tokens = normalize(name)
    .replace(/[()]/g, ' ')
    .replace(/'/g, '')
    .split(/\s+/)
    .filter(Boolean);

  return tokens
    .map((token) => words[token.toLowerCase()] ?? token)
    .filter(Boolean)
    .join('');
};

const translateSpecialPatterns = (displayName: string, words: Dict): string | null => {
  const blockOf = displayName.match(/^Block of (.+)$/);
  if (blockOf) return `${translateWords(blockOf[1], words)}块`;

  const minecartWith = displayName.match(/^Minecart with (.+)$/);
  if (minecartWith) return `${translateWords(minecartWith[1], words)}矿车`;

  const weightedPlate = displayName.match(/^Weighted Pressure Plate \((Light|Heavy)\)$/);
  if (weightedPlate) return `${weightedPlate[1] === 'Light' ? words.light : words.heavy}测重压力板`;

  const materialTool = displayName.split(/\s+/);
  if (materialTool.length === 2 && MATERIAL_SUFFIXES.has(materialTool[1].toLowerCase())) {
    return `${words[materialTool[0].toLowerCase()] ?? materialTool[0]}${words[materialTool[1].toLowerCase()] ?? materialTool[1]}`;
  }

  return null;
};

export function localizeItemDisplayName(locale: Locale, registryName: string, fallbackName?: string): string {
  const displayName = fallbackName || titleCaseFromName(registryName);
  if (locale === 'en') return displayName;

  const exact = locale === 'zh-TW' ? ZH_TW_EXACT : ZH_CN_EXACT;
  const words = locale === 'zh-TW' ? ZH_TW_WORDS : ZH_CN_WORDS;
  const exactHit = exact[displayName];
  if (exactHit) return exactHit;

  const patternHit = translateSpecialPatterns(displayName, words);
  if (patternHit) return patternHit;

  return translateWords(displayName || registryName, words);
}
