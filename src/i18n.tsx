import React, { createContext, useContext, useState, useEffect } from 'react';
import { BlockRegistry } from './world/BlockRegistry';
import { ItemRegistry } from './items/ItemRegistry';
import { localizeItemDisplayName } from './i18nItemNames';

export type Locale = 'en' | 'zh-CN' | 'zh-TW';

export interface TranslationsSchema {
  // Welcome Menu
  singleplayer: string;
  controlsInstructions: string;
  selectWorld: string;
  emptyWorldSlot: string;
  play: string;
  delete: string;
  createWorld: string;
  cancel: string;
  back: string;
  chooseGameMode: string;
  survivalMode: string;
  creativeMode: string;
  survivalDesc: string;
  creativeDesc: string;
  confirmDelete: string;
  loadingWorld: string;
  buildingTerrain: string;
  worldSlot: string;
  modeLabel: string;
  posLabel: string;

  // Pause Menu
  gameMenu: string;
  backToGame: string;
  saveGame: string;
  saveAndQuit: string;
  gameSaved: string;

  // Death Screen
  youDied: string;
  respawn: string;

  // Controls
  controlsTitle: string;
  controlMove: string;
  controlJump: string;
  controlSprint: string;
  controlFly: string;
  controlOffhand: string;
  controlLook: string;
  controlBreak: string;
  controlPlace: string;
  controlHotbar: string;
  controlInventory: string;
  controlPerspective: string;
  controlDebug: string;
  controlTips: string;

  // Common UI
  closeEsc: string;
  inventory: string;
  hotbar: string;
  armor: string;
  offhand: string;
  crafting2x2: string;
  craftingTable3x3: string;
  creativeCatalog: string;
  creativeSearchPlaceholder: string;
  creativeNoResults: string;
  furnace: string;
  smoker: string;
  blastFurnace: string;
  input: string;
  fuel: string;
  output: string;
  brewingIngredient: string;
  brewingBottle: string;
  brewingNeeds: string;
  chest: string;
  hopper: string;
  done: string;
  durability: string;

  // Debug Overlay
  fps: string;
  xyz: string;
  biome: string;
  chunks: string;
  mobs: string;
  time: string;
  day: string;
  night: string;
  block: string;
  mode: string;
  slot: string;
  ground: string;
  flying: string;
  yes: string;
  no: string;
  debugFooter: string;

  // Splash texts
  splashTexts: string[];

  // Item/Block categories
  catBlock: string;
  catTool: string;
  catFood: string;
  catMaterial: string;
  catArmor: string;

  // Biomes
  biomePlains: string;
  biomeDesert: string;
  biomeMountains: string;
  biomeForest: string;
  biomeSnow: string;
  biomeOcean: string;
  biomeUnknown: string;

  // Blocks (dynamic lookup keys)
  block_stone: string;
  block_grass_block: string;
  block_dirt: string;
  block_cobblestone: string;
  block_oak_planks: string;
  block_oak_log: string;
  block_oak_leaves: string;
  block_sand: string;
  block_gravel: string;
  block_gold_ore: string;
  block_iron_ore: string;
  block_coal_ore: string;
  block_water: string;
  block_lava: string;
  block_sandstone: string;
  block_white_wool: string;
  block_gold_block: string;
  block_iron_block: string;
  block_bricks: string;
  block_bookshelf: string;
  block_tnt: string;
  block_diamond_ore: string;
  block_diamond_block: string;
  block_crafting_table: string;
  block_furnace: string;
  block_smoker: string;
  block_blast_furnace: string;
  block_glass: string;
  block_snow_block: string;
  block_ice: string;
  block_clay: string;
  block_torch: string;
  block_redstone_wire: string;
  block_repeater: string;
  block_piston: string;
  block_lever: string;
  block_obsidian: string;
  block_chest: string;
  block_oak_door: string;
  block_oak_door_open: string;
  block_oak_trapdoor: string;
  block_oak_trapdoor_open: string;

  // Items
  item_stick: string;
  item_coal: string;
  item_iron_ingot: string;
  item_gold_ingot: string;
  item_diamond: string;
  item_iron_nugget: string;
  item_gold_nugget: string;
  item_string: string;
  item_flint: string;
  item_paper: string;
  item_book: string;
  item_redstone: string;
  item_lapis: string;
  item_feather: string;
  item_wooden_sword: string;
  item_wooden_shovel: string;
  item_wooden_pickaxe: string;
  item_wooden_axe: string;
  item_stone_sword: string;
  item_stone_shovel: string;
  item_stone_pickaxe: string;
  item_stone_axe: string;
  item_iron_sword: string;
  item_iron_shovel: string;
  item_iron_pickaxe: string;
  item_iron_axe: string;
  item_diamond_sword: string;
  item_diamond_shovel: string;
  item_diamond_pickaxe: string;
  item_diamond_axe: string;
  item_golden_sword: string;
  item_golden_shovel: string;
  item_golden_pickaxe: string;
  item_golden_axe: string;
  item_apple: string;
  item_bread: string;
  item_cooked_beef: string;
  item_raw_beef: string;
  item_raw_porkchop: string;
  item_cooked_porkchop: string;
  item_wheat: string;
  item_seeds: string;
  item_bucket: string;
  item_iron_helmet: string;
  item_iron_chestplate: string;
  item_iron_leggings: string;
  item_iron_boots: string;
  item_diamond_helmet: string;
  item_diamond_chestplate: string;
  item_diamond_leggings: string;
  item_diamond_boots: string;
}

export const translations: Record<Locale, TranslationsSchema> = {
  en: {
    singleplayer: 'Singleplayer',
    controlsInstructions: 'Controls & Instructions',
    selectWorld: 'Select World',
    emptyWorldSlot: '[Empty World Slot]',
    play: 'Play',
    delete: 'Delete',
    createWorld: 'Create World',
    cancel: 'Cancel',
    back: 'Back',
    chooseGameMode: 'Choose Game Mode',
    survivalMode: 'Survival Mode',
    creativeMode: 'Creative Mode',
    survivalDesc: 'Search for resources, crafting, gain health and hunger. Mobs are hostile, and blocks take time to break. Flying is disabled.',
    creativeDesc: 'Infinite resources, free flying, and destroy blocks instantly. You are invulnerable to all damage, and can browse the item catalog.',
    confirmDelete: 'Are you sure you want to delete {slot}?',
    loadingWorld: 'Loading World...',
    buildingTerrain: 'Building Terrain',
    worldSlot: 'World Slot {num}',
    modeLabel: 'Mode: {mode}',
    posLabel: 'Pos: {pos}',
    gameMenu: 'Game Menu',
    backToGame: 'Back to Game',
    saveGame: 'Save Game',
    saveAndQuit: 'Save & Quit to Title',
    gameSaved: 'Game Saved!',
    youDied: 'You died!',
    respawn: 'Respawn',
    controlsTitle: 'Controls & Instructions',
    controlMove: 'W / A / S / D — Move',
    controlJump: 'Space — Jump',
    controlSprint: 'Shift — Sprint',
    controlFly: 'Double Space — Toggle Fly (Creative mode only)',
    controlOffhand: 'F — Swap main hand and offhand',
    controlLook: 'Mouse — Look around',
    controlBreak: 'Left Click — Break block / Attack mob',
    controlPlace: 'Right Click — Place block / Open UI / Eat food',
    controlHotbar: '1-9 — Select hotbar slot',
    controlInventory: 'E — Inventory (Catalog list in Creative mode)',
    controlPerspective: 'F5 — Toggle perspective',
    controlDebug: 'F3 — Toggle debug overlay',
    controlTips: '* Tips: In Survival mode, hold Right Click with food in hand to eat. Mobs attack at night. Autosave saves progress every 60 seconds.',
    closeEsc: 'Close (Esc)',
    inventory: 'Inventory',
    hotbar: 'Hotbar',
    armor: 'Armor',
    offhand: 'Offhand',
    crafting2x2: 'Crafting (2×2)',
    craftingTable3x3: 'Crafting Table (3×3)',
    creativeCatalog: 'Creative Catalog',
    creativeSearchPlaceholder: 'Search items...',
    creativeNoResults: 'No matching items',
    furnace: 'Furnace',
    smoker: 'Smoker',
    blastFurnace: 'Blast Furnace',
    input: 'Input',
    fuel: 'Fuel',
    output: 'Output',
    brewingIngredient: 'Ingredient',
    brewingBottle: 'Bottle',
    brewingNeeds: 'Add bottles, fuel, and ingredient',
    chest: 'Chest',
    hopper: 'Hopper',
    done: 'Done',
    durability: 'Durability: {current} / {max}',
    fps: '{fps} fps',
    xyz: 'XYZ: {x} / {y} / {z}',
    biome: 'Biome: {biome}',
    chunks: 'Chunks: {chunks}',
    mobs: 'Mobs: {mobs}',
    time: 'Time: {time}',
    day: 'Day',
    night: 'Night',
    block: 'Block: {block}',
    mode: 'Mode: {mode}',
    slot: 'Slot: {slot}/9',
    ground: 'Ground: {ground}',
    flying: 'Flying: {flying}',
    yes: 'yes',
    no: 'no',
    debugFooter: 'F3: Debug | F: Fly | LMB: Break | RMB: Place',
    splashTexts: [
      'Also try Terraria!',
      'TypeScript powered!',
      'Gemini powered!',
      'Invulnerable in Creative!',
      'Fly with F key!',
      'Craft and survive!',
      'Minecraft in React!',
      'Infinite worlds!',
      'Redstone simulated!',
      '3D blocky adventure!',
      'Watch out for Creepers!'
    ],
    catBlock: 'block',
    catTool: 'tool',
    catFood: 'food',
    catMaterial: 'material',
    catArmor: 'armor',
    biomePlains: 'Plains',
    biomeDesert: 'Desert',
    biomeMountains: 'Mountains',
    biomeForest: 'Forest',
    biomeSnow: 'Snow',
    biomeOcean: 'Ocean',
    biomeUnknown: 'Unknown',
    block_stone: 'Stone',
    block_grass_block: 'Grass Block',
    block_dirt: 'Dirt',
    block_cobblestone: 'Cobblestone',
    block_oak_planks: 'Oak Planks',
    block_oak_log: 'Oak Log',
    block_oak_leaves: 'Oak Leaves',
    block_sand: 'Sand',
    block_gravel: 'Gravel',
    block_gold_ore: 'Gold Ore',
    block_iron_ore: 'Iron Ore',
    block_coal_ore: 'Coal Ore',
    block_water: 'Water',
    block_lava: 'Lava',
    block_sandstone: 'Sandstone',
    block_white_wool: 'White Wool',
    block_gold_block: 'Gold Block',
    block_iron_block: 'Iron Block',
    block_bricks: 'Bricks',
    block_bookshelf: 'Bookshelf',
    block_tnt: 'TNT',
    block_diamond_ore: 'Diamond Ore',
    block_diamond_block: 'Diamond Block',
    block_crafting_table: 'Crafting Table',
    block_furnace: 'Furnace',
    block_smoker: 'Smoker',
    block_blast_furnace: 'Blast Furnace',
    block_glass: 'Glass',
    block_snow_block: 'Snow Block',
    block_ice: 'Ice',
    block_clay: 'Clay',
    block_torch: 'Torch',
    block_redstone_wire: 'Redstone Wire',
    block_repeater: 'Redstone Repeater',
    block_piston: 'Piston',
    block_lever: 'Lever',
    block_obsidian: 'Obsidian',
    block_chest: 'Chest',
    block_oak_door: 'Oak Door',
    block_oak_door_open: 'Open Oak Door',
    block_oak_trapdoor: 'Oak Trapdoor',
    block_oak_trapdoor_open: 'Open Oak Trapdoor',
    item_stick: 'Stick',
    item_coal: 'Coal',
    item_iron_ingot: 'Iron Ingot',
    item_gold_ingot: 'Gold Ingot',
    item_diamond: 'Diamond',
    item_iron_nugget: 'Iron Nugget',
    item_gold_nugget: 'Gold Nugget',
    item_string: 'String',
    item_flint: 'Flint',
    item_paper: 'Paper',
    item_book: 'Book',
    item_redstone: 'Redstone',
    item_lapis: 'Lapis Lazuli',
    item_feather: 'Feather',
    item_wooden_sword: 'Wooden Sword',
    item_wooden_shovel: 'Wooden Shovel',
    item_wooden_pickaxe: 'Wooden Pickaxe',
    item_wooden_axe: 'Wooden Axe',
    item_stone_sword: 'Stone Sword',
    item_stone_shovel: 'Stone Shovel',
    item_stone_pickaxe: 'Stone Pickaxe',
    item_stone_axe: 'Stone Axe',
    item_iron_sword: 'Iron Sword',
    item_iron_shovel: 'Iron Shovel',
    item_iron_pickaxe: 'Iron Pickaxe',
    item_iron_axe: 'Iron Axe',
    item_diamond_sword: 'Diamond Sword',
    item_diamond_shovel: 'Diamond Shovel',
    item_diamond_pickaxe: 'Diamond Pickaxe',
    item_diamond_axe: 'Diamond Axe',
    item_golden_sword: 'Golden Sword',
    item_golden_shovel: 'Golden Shovel',
    item_golden_pickaxe: 'Golden Pickaxe',
    item_golden_axe: 'Golden Axe',
    item_apple: 'Apple',
    item_bread: 'Bread',
    item_cooked_beef: 'Steak',
    item_raw_beef: 'Raw Beef',
    item_raw_porkchop: 'Raw Porkchop',
    item_cooked_porkchop: 'Cooked Porkchop',
    item_wheat: 'Wheat',
    item_seeds: 'Seeds',
    item_bucket: 'Bucket',
    item_iron_helmet: 'Iron Helmet',
    item_iron_chestplate: 'Iron Chestplate',
    item_iron_leggings: 'Iron Leggings',
    item_iron_boots: 'Iron Boots',
    item_diamond_helmet: 'Diamond Helmet',
    item_diamond_chestplate: 'Diamond Chestplate',
    item_diamond_leggings: 'Diamond Leggings',
    item_diamond_boots: 'Diamond Boots',
  },
  'zh-CN': {
    singleplayer: '单人游戏',
    controlsInstructions: '控制与说明',
    selectWorld: '选择世界',
    emptyWorldSlot: '[空的世界存档]',
    play: '进入游戏',
    delete: '删除',
    createWorld: '创建世界',
    cancel: '取消',
    back: '返回',
    chooseGameMode: '选择游戏模式',
    survivalMode: '生存模式',
    creativeMode: '创造模式',
    survivalDesc: '收集资源，合成物品，获取生命值和饥饿值。怪物具有敌意，破坏方块需要时间。飞行已禁用。',
    creativeDesc: '无限资源，自由飞行，瞬间破坏方块。免受一切伤害，可以浏览物品目录。',
    confirmDelete: '确定要删除 {slot} 吗？',
    loadingWorld: '正在加载世界...',
    buildingTerrain: '正在构建地形',
    worldSlot: '存档槽位 {num}',
    modeLabel: '模式: {mode}',
    posLabel: '位置: {pos}',
    gameMenu: '游戏菜单',
    backToGame: '返回游戏',
    saveGame: '保存游戏',
    saveAndQuit: '保存并退回主菜单',
    gameSaved: '游戏已保存！',
    youDied: '你死了！',
    respawn: '重生',
    controlsTitle: '控制与说明',
    controlMove: 'W / A / S / D — 移动',
    controlJump: '空格键 — 跳跃',
    controlSprint: 'Shift键 — 疾跑',
    controlFly: '双击空格键 — 切换飞行 (仅限创造模式)',
    controlOffhand: 'F键 — 交换主手与副手物品',
    controlLook: '鼠标 — 环顾四周',
    controlBreak: '左键单击 — 破坏方块 / 攻击怪物',
    controlPlace: '右键单击 — 放置方块 / 打开界面 / 吃食物',
    controlHotbar: '1-9 — 选择快捷栏槽位',
    controlInventory: 'E键 — 打开背包 (创造模式下为物品目录)',
    controlPerspective: 'F5键 — 切换视角',
    controlDebug: 'F3键 — 切换调试信息图层',
    controlTips: '* 提示：在生存模式下，手持食物时长按右键可食用。怪物在夜间出没。每隔 60 秒自动保存一次进度。',
    closeEsc: '关闭 (Esc)',
    inventory: '背包',
    hotbar: '快捷栏',
    armor: '装备',
    offhand: '副手',
    crafting2x2: '合成 (2×2)',
    craftingTable3x3: '工作台 (3×3)',
    creativeCatalog: '创造模式物品栏',
    creativeSearchPlaceholder: '搜索物品...',
    creativeNoResults: '没有匹配的物品',
    furnace: '熔炉',
    smoker: '烟熏炉',
    blastFurnace: '高炉',
    input: '输入',
    fuel: '燃料',
    output: '输出',
    brewingIngredient: '原料',
    brewingBottle: '瓶子',
    brewingNeeds: '加入瓶子、燃料和原料',
    chest: '箱子',
    hopper: '漏斗',
    done: '完成',
    durability: '耐久度: {current} / {max}',
    fps: '{fps} 帧/秒',
    xyz: 'XYZ坐标: {x} / {y} / {z}',
    biome: '生物群系: {biome}',
    chunks: '区块数: {chunks}',
    mobs: '怪物数: {mobs}',
    time: '时间: {time}',
    day: '白天',
    night: '夜晚',
    block: '当前方块: {block}',
    mode: '游戏模式: {mode}',
    slot: '槽位: {slot}/9',
    ground: '在地面上: {ground}',
    flying: '飞行中: {flying}',
    yes: '是',
    no: '否',
    debugFooter: 'F3: 调试 | F: 飞行 | 左键: 破坏 | 右键: 放置',
    splashTexts: [
      '也试试泰拉瑞亚吧！',
      '由 TypeScript 驱动！',
      '由 Gemini 驱动！',
      '在创造模式中无敌！',
      '按 F 键飞行！',
      '合成与生存！',
      'React 中的我的世界！',
      '无限的世界！',
      '红石模拟！',
      '3D方块冒险！',
      '小心苦力怕！'
    ],
    catBlock: '方块',
    catTool: '工具',
    catFood: '食物',
    catMaterial: '材料',
    catArmor: '装备',
    biomePlains: '平原',
    biomeDesert: '沙漠',
    biomeMountains: '山地',
    biomeForest: '森林',
    biomeSnow: '雪地',
    biomeOcean: '海洋',
    biomeUnknown: '未知',
    block_stone: '石头',
    block_grass_block: '草方块',
    block_dirt: '泥土',
    block_cobblestone: '圆石',
    block_oak_planks: '橡木木板',
    block_oak_log: '橡木原木',
    block_oak_leaves: '橡木树叶',
    block_sand: '沙子',
    block_gravel: '沙砾',
    block_gold_ore: '金矿石',
    block_iron_ore: '铁矿石',
    block_coal_ore: '煤矿石',
    block_water: '水',
    block_lava: '岩浆',
    block_sandstone: '砂岩',
    block_white_wool: '白色羊毛',
    block_gold_block: '金块',
    block_iron_block: '铁块',
    block_bricks: '砖块',
    block_bookshelf: '书架',
    block_tnt: 'TNT',
    block_diamond_ore: '钻石矿石',
    block_diamond_block: '钻石块',
    block_crafting_table: '工作台',
    block_furnace: '熔炉',
    block_smoker: '烟熏炉',
    block_blast_furnace: '高炉',
    block_glass: '玻璃',
    block_snow_block: '雪块',
    block_ice: '冰',
    block_clay: '粘土',
    block_torch: '火把',
    block_redstone_wire: '红石线',
    block_repeater: '红石中继器',
    block_piston: '活塞',
    block_lever: '拉杆',
    block_obsidian: '黑曜石',
    block_chest: '箱子',
    block_oak_door: '橡木门',
    block_oak_door_open: '开着的橡木门',
    block_oak_trapdoor: '橡木活板门',
    block_oak_trapdoor_open: '开着的橡木活板门',
    item_stick: '木棒',
    item_coal: '煤炭',
    item_iron_ingot: '铁锭',
    item_gold_ingot: '金锭',
    item_diamond: '钻石',
    item_iron_nugget: '铁粒',
    item_gold_nugget: '金粒',
    item_string: '线',
    item_flint: '燧石',
    item_paper: '纸',
    item_book: '书',
    item_redstone: '红石粉',
    item_lapis: '青金石',
    item_feather: '羽毛',
    item_wooden_sword: '木剑',
    item_wooden_shovel: '木铲',
    item_wooden_pickaxe: '木镐',
    item_wooden_axe: '木斧',
    item_stone_sword: '石剑',
    item_stone_shovel: '石铲',
    item_stone_pickaxe: '石镐',
    item_stone_axe: '石斧',
    item_iron_sword: '铁剑',
    item_iron_shovel: '铁铲',
    item_iron_pickaxe: '铁镐',
    item_iron_axe: '铁斧',
    item_diamond_sword: '钻石剑',
    item_diamond_shovel: '钻石铲',
    item_diamond_pickaxe: '钻石镐',
    item_diamond_axe: '钻石斧',
    item_golden_sword: '金剑',
    item_golden_shovel: '金铲',
    item_golden_pickaxe: '金镐',
    item_golden_axe: '金斧',
    item_apple: '苹果',
    item_bread: '面包',
    item_cooked_beef: '牛排',
    item_raw_beef: '生牛肉',
    item_raw_porkchop: '生猪肉',
    item_cooked_porkchop: '熟猪肉',
    item_wheat: '小麦',
    item_seeds: '种子',
    item_bucket: '铁桶',
    item_iron_helmet: '铁头盔',
    item_iron_chestplate: '铁胸甲',
    item_iron_leggings: '铁护腿',
    item_iron_boots: '铁靴子',
    item_diamond_helmet: '钻石头盔',
    item_diamond_chestplate: '钻石胸甲',
    item_diamond_leggings: '钻石护腿',
    item_diamond_boots: '钻石靴子',
  },
  'zh-TW': {
    singleplayer: '單人遊戲',
    controlsInstructions: '控制與說明',
    selectWorld: '選擇世界',
    emptyWorldSlot: '[空的世界存檔]',
    play: '進入遊戲',
    delete: '刪除',
    createWorld: '創建世界',
    cancel: '取消',
    back: '返回',
    chooseGameMode: '選擇遊戲模式',
    survivalMode: '生存模式',
    creativeMode: '創造模式',
    survivalDesc: '收集資源，合成物品，獲取生命值和饑餓值。怪物具有敵意，破壞方塊需要時間。飛行已禁用。',
    creativeDesc: '無限資源，自由飛行，瞬間破壞方塊。免受一切傷害，可以瀏覽物品目錄。',
    confirmDelete: '確定要刪除 {slot} 嗎？',
    loadingWorld: '正在載入世界...',
    buildingTerrain: '正在構建地形',
    worldSlot: '存檔槽位 {num}',
    modeLabel: '模式: {mode}',
    posLabel: '位置: {pos}',
    gameMenu: '遊戲菜單',
    backToGame: '返回遊戲',
    saveGame: '保存遊戲',
    saveAndQuit: '保存並退回主菜單',
    gameSaved: '遊戲已保存！',
    youDied: '你死了！',
    respawn: '重生',
    controlsTitle: '控制與說明',
    controlMove: 'W / A / S / D — 移動',
    controlJump: '空格鍵 — 跳躍',
    controlSprint: 'Shift鍵 — 疾跑',
    controlFly: '雙擊空格鍵 — 切換飛行 (僅限創造模式)',
    controlOffhand: 'F鍵 — 交換主手與副手物品',
    controlLook: '滑鼠 — 環顧四周',
    controlBreak: '左鍵單擊 — 破壞方塊 / 攻擊怪物',
    controlPlace: '右鍵單擊 — 放置方块 / 打開介面 / 吃食物',
    controlHotbar: '1-9 — 選擇快捷欄槽位',
    controlInventory: 'E鍵 — 打開背包 (創造模式下為物品目錄)',
    controlPerspective: 'F5鍵 — 切換視角',
    controlDebug: 'F3鍵 — 切換調試資訊圖層',
    controlTips: '* 提示：在生存模式下，手持食物時長按右鍵可食用。怪物在夜間出沒。每隔 60 秒自動保存一次進度。',
    closeEsc: '關閉 (Esc)',
    inventory: '背包',
    hotbar: '快捷欄',
    armor: '裝備',
    offhand: '副手',
    crafting2x2: '合成 (2×2)',
    craftingTable3x3: '工作台 (3×3)',
    creativeCatalog: '創造模式物品欄',
    creativeSearchPlaceholder: '搜尋物品...',
    creativeNoResults: '沒有匹配的物品',
    furnace: '熔爐',
    smoker: '煙燻爐',
    blastFurnace: '高爐',
    input: '輸入',
    fuel: '燃料',
    output: '輸出',
    brewingIngredient: '原料',
    brewingBottle: '瓶子',
    brewingNeeds: '放入瓶子、燃料和原料',
    chest: '箱子',
    hopper: '漏斗',
    done: '完成',
    durability: '耐久度: {current} / {max}',
    fps: '{fps} 幀/秒',
    xyz: 'XYZ座標: {x} / {y} / {z}',
    biome: '生物群系: {biome}',
    chunks: '區塊數: {chunks}',
    mobs: '怪物數: {mobs}',
    time: '時間: {time}',
    day: '白天',
    night: '夜晚',
    block: '當前方塊: {block}',
    mode: '遊戲模式: {mode}',
    slot: '槽位: {slot}/9',
    ground: '在地面上: {ground}',
    flying: '飛行中: {flying}',
    yes: '是',
    no: '否',
    debugFooter: 'F3: 調試 | F: 飛行 | 左鍵: 破壞 | 右鍵: 放置',
    splashTexts: [
      '也試試泰拉瑞亞吧！',
      '由 TypeScript 驅動！',
      '由 Gemini 驅動！',
      '在創造模式中無敵！',
      '按 F 鍵飛行！',
      '合成與生存！',
      'React 中的我的世界！',
      '無限的世界！',
      '紅石模擬！',
      '3D方塊冒險！',
      '小心苦力怕！'
    ],
    catBlock: '方塊',
    catTool: '工具',
    catFood: '食物',
    catMaterial: '材料',
    catArmor: '裝備',
    biomePlains: '平原',
    biomeDesert: '沙漠',
    biomeMountains: '山地',
    biomeForest: '森林',
    biomeSnow: '雪地',
    biomeOcean: '海洋',
    biomeUnknown: '未知',
    block_stone: '石頭',
    block_grass_block: '草方塊',
    block_dirt: '泥土',
    block_cobblestone: '圓石',
    block_oak_planks: '橡木木板',
    block_oak_log: '橡木原木',
    block_oak_leaves: '橡木樹葉',
    block_sand: '沙子',
    block_gravel: '沙礫',
    block_gold_ore: '金礦石',
    block_iron_ore: '鐵礦石',
    block_coal_ore: '煤礦石',
    block_water: '水',
    block_lava: '岩漿',
    block_sandstone: '砂岩',
    block_white_wool: '白色羊毛',
    block_gold_block: '金塊',
    block_iron_block: '鐵塊',
    block_bricks: '磚塊',
    block_bookshelf: '書架',
    block_tnt: 'TNT',
    block_diamond_ore: '鑽石礦石',
    block_diamond_block: '鑽石塊',
    block_crafting_table: '工作台',
    block_furnace: '熔爐',
    block_smoker: '煙燻爐',
    block_blast_furnace: '高爐',
    block_glass: '玻璃',
    block_snow_block: '雪塊',
    block_ice: '冰',
    block_clay: '粘土',
    block_torch: '火把',
    block_redstone_wire: '紅石線',
    block_repeater: '紅石中繼器',
    block_piston: '活塞',
    block_lever: '拉杆',
    block_obsidian: '黑曜石',
    block_chest: '箱子',
    block_oak_door: '橡木門',
    block_oak_door_open: '開著的橡木門',
    block_oak_trapdoor: '橡木活板門',
    block_oak_trapdoor_open: '開著的橡木活板門',
    item_stick: '木棒',
    item_coal: '煤炭',
    item_iron_ingot: '鐵錠',
    item_gold_ingot: '金錠',
    item_diamond: '鑽石',
    item_iron_nugget: '鐵粒',
    item_gold_nugget: '金粒',
    item_string: '線',
    item_flint: '燧石',
    item_paper: '紙',
    item_book: '書',
    item_redstone: '紅石粉',
    item_lapis: '青金石',
    item_feather: '羽毛',
    item_wooden_sword: '木劍',
    item_wooden_shovel: '木鏟',
    item_wooden_pickaxe: '木鎬',
    item_wooden_axe: '木斧',
    item_stone_sword: '石劍',
    item_stone_shovel: '石鏟',
    item_stone_pickaxe: '石鎬',
    item_stone_axe: '石斧',
    item_iron_sword: '鐵劍',
    item_iron_shovel: '鐵鏟',
    item_iron_pickaxe: '鐵鎬',
    item_iron_axe: '鐵斧',
    item_diamond_sword: '鑽石劍',
    item_diamond_shovel: '鑽石鏟',
    item_diamond_pickaxe: '鑽石鎬',
    item_diamond_axe: '鑽石斧',
    item_golden_sword: '金劍',
    item_golden_shovel: '金鏟',
    item_golden_pickaxe: '金鎬',
    item_golden_axe: '金斧',
    item_apple: '蘋果',
    item_bread: '麵包',
    item_cooked_beef: '牛排',
    item_raw_beef: '生牛肉',
    item_raw_porkchop: '生豬肉',
    item_cooked_porkchop: '熟豬肉',
    item_wheat: '小麥',
    item_seeds: '種子',
    item_bucket: '鐵桶',
    item_iron_helmet: '鐵頭盔',
    item_iron_chestplate: '鐵胸甲',
    item_iron_leggings: '鐵護腿',
    item_iron_boots: '鐵靴子',
    item_diamond_helmet: '鑽石頭盔',
    item_diamond_chestplate: '鑽石胸甲',
    item_diamond_leggings: '鑽石護腿',
    item_diamond_boots: '鑽石格鬥靴',
  }
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof TranslationsSchema, variables?: Record<string, string | number>) => string;
  getLocalizedItemName: (id: number, fallbackName?: string) => string;
  getLocalizedDisplayName: (displayName: string, registryName?: string) => string;
  getLocalizedCategory: (category: string) => string;
  getLocalizedBiomeName: (biome: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'mc_language';

const getBrowserLanguage = (): Locale => {
  const lang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
  if (lang.startsWith('zh-TW') || lang.startsWith('zh-HK') || lang.startsWith('zh-MO') || lang.toLowerCase().includes('hant')) {
    return 'zh-TW';
  }
  if (lang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh-CN' || saved === 'zh-TW') {
      return saved as Locale;
    }
    return getBrowserLanguage();
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  };

  const t = (key: keyof TranslationsSchema, variables?: Record<string, string | number>): string => {
    const dict = translations[locale];
    let val = (dict[key] || translations['en'][key]) as string | string[];
    if (Array.isArray(val)) {
      return ''; // splashTexts is handled separately
    }
    if (!val) return String(key);

    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        val = (val as string).replace(`{${k}}`, String(v));
      });
    }
    return val as string;
  };

  const getLocalizedItemName = (id: number, fallbackName?: string): string => {
    const isBlock = (id & 0x3FF) < 256;
    const prefix = isBlock ? 'block_' : 'item_';

    let lookupName = '';

    // Get exact name from registry
    if (isBlock) {
      lookupName = BlockRegistry.get(id)?.name ?? '';
    } else {
      lookupName = ItemRegistry.get(id)?.name ?? '';
    }

    if (!lookupName && fallbackName) {
      lookupName = fallbackName.toLowerCase().replace(/\s+/g, '_');
    }
    // Remove namespaces
    lookupName = lookupName.replace(/^minecraft:/, '');

    // Check direct static translation first
    const key = `${prefix}${lookupName}` as keyof TranslationsSchema;
    const localized = translations[locale][key] as string;
    if (localized) {
      return localized;
    }

    if (locale !== 'en' && lookupName) {
      return localizeItemDisplayName(locale, lookupName, fallbackName);
    }

    if (fallbackName) return fallbackName;
    return lookupName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';
  };

  const getLocalizedDisplayName = (displayName: string, registryName?: string): string => {
    return localizeItemDisplayName(locale, registryName ?? displayName, displayName);
  };

  const getLocalizedCategory = (category: string): string => {
    const key = `cat${category.charAt(0).toUpperCase()}${category.slice(1)}` as keyof TranslationsSchema;
    return t(key) || category;
  };

  const getLocalizedBiomeName = (biome: string): string => {
    // Standard biomes are: Plains, Desert, Mountains, Forest, Snow, Ocean, Unknown
    const key = `biome${biome}` as keyof TranslationsSchema;
    return t(key) || biome;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, getLocalizedItemName, getLocalizedDisplayName, getLocalizedCategory, getLocalizedBiomeName }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
