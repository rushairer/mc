import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const officialRoot = process.argv[2] ?? 'scripts/tmp-minecraft-official/extract/assets/minecraft';
const reportPath = process.argv[3] ?? 'docs/VANILLA_26_2_COVERAGE.md';

async function downloadJson(url, file) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(await response.json(), null, 2));
}

async function downloadFile(url, file) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

async function ensureOfficialRoot(root) {
  if (fs.existsSync(path.join(root, 'items')) && fs.existsSync(path.join(root, 'blockstates'))) return;

  const cacheDir = 'scripts/tmp-minecraft-official';
  const manifestPath = path.join(cacheDir, 'version_manifest_v2.json');
  const versionPath = path.join(cacheDir, 'latest.json');
  const clientPath = path.join(cacheDir, 'client.jar');

  await downloadJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const latest = manifest.versions.find((version) => version.id === manifest.latest.release);
  if (!latest) throw new Error(`Unable to find latest release ${manifest.latest.release}`);

  await downloadJson(latest.url, versionPath);
  const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  await downloadFile(version.downloads.client.url, clientPath);

  fs.rmSync(path.join(cacheDir, 'extract'), { recursive: true, force: true });
  fs.mkdirSync(path.join(cacheDir, 'extract'), { recursive: true });
  execFileSync('unzip', [
    '-q',
    clientPath,
    'assets/minecraft/items/*.json',
    'assets/minecraft/blockstates/*.json',
    'assets/minecraft/models/item/*.json',
    '-d',
    path.join(cacheDir, 'extract'),
  ]);
}

await ensureOfficialRoot(officialRoot);

const items = JSON.parse(fs.readFileSync('src/items/data/items.json', 'utf8'));
const blocks = JSON.parse(fs.readFileSync('src/items/data/blocks.json', 'utf8'));

const normalize = (name) => name
  .replace(/^minecraft:/, '')
  .replace(/^raw_/, '')
  .replace(/^cooked_/, 'cooked_')
  .replace(/^speckled_melon$/, 'glistering_melon_slice')
  .replace(/^melon$/, 'melon_slice')
  .replace(/^melon_block$/, 'melon')
  .replace(/^wooden_planks$/, 'oak_planks')
  .replace(/^planks$/, 'oak_planks')
  .replace(/^wood$/, 'oak_log')
  .replace(/^log$/, 'oak_log')
  .replace(/^leaves$/, 'oak_leaves')
  .replace(/^sapling$/, 'oak_sapling')
  .replace(/^fence$/, 'oak_fence')
  .replace(/^fence_gate$/, 'oak_fence_gate')
  .replace(/^stonebrick$/, 'stone_bricks')
  .replace(/^brick_block$/, 'bricks')
  .replace(/^nether_brick$/, 'nether_bricks')
  .replace(/^netherbrick$/, 'nether_brick')
  .replace(/^yellow_flower$/, 'dandelion')
  .replace(/^red_flower$/, 'poppy')
  .replace(/^deadbush$/, 'dead_bush')
  .replace(/^web$/, 'cobweb')
  .replace(/^reeds$/, 'sugar_cane')
  .replace(/^tallgrass$/, 'grass')
  .replace(/^snow_layer$/, 'snow')
  .replace(/^golden_rail$/, 'powered_rail')
  .replace(/^command_block_minecart$/, 'command_block_minecart')
  .replace(/^record_/, 'music_disc_')
  .replace(/^clownfish$/, 'tropical_fish')
  .replace(/^raw_fish$/, 'cod')
  .replace(/^cooked_fish$/, 'cooked_cod')
  .replace(/^beef$/, 'raw_beef')
  .replace(/^chicken$/, 'raw_chicken')
  .replace(/^mutton$/, 'raw_mutton')
  .replace(/^rabbit$/, 'raw_rabbit')
  .replace(/^porkchop$/, 'raw_porkchop')
  .replace(/^carrot_on_a_stick$/, 'carrot_on_a_stick');

const titleCase = (name) => normalize(name)
  .split('_')
  .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
  .join(' ');

const listJsonNames = (dir) => fs.readdirSync(path.join(officialRoot, dir))
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

const officialItems = listJsonNames('items');
const officialBlocks = listJsonNames('blockstates');

const repoItemNames = new Set(items.map((item) => normalize(item.name)));
const repoBlockNames = new Set(blocks.map((block) => normalize(block.name)));
const repoInventoryNames = new Set([...repoItemNames, ...repoBlockNames]);

const ignoredGeneratedItemModels = [
  /_open_(front|back)$/,
  /_pulling_[0-9]$/,
  /_brushing_[0-9]$/,
  /_throwing$/,
  /_in_hand$/,
];

const filteredOfficialItems = officialItems.filter((name) =>
  !ignoredGeneratedItemModels.some((pattern) => pattern.test(name))
);

const missingItems = filteredOfficialItems.filter((name) => !repoInventoryNames.has(normalize(name)));
const missingBlocks = officialBlocks.filter((name) => !repoBlockNames.has(normalize(name)));

const nonBlockOfficialItems = filteredOfficialItems.filter((name) => !officialBlocks.includes(name));
const missingNonBlockItems = nonBlockOfficialItems.filter((name) => !repoItemNames.has(normalize(name)));

const blockItemMissingImplementation = missingItems.filter((name) => officialBlocks.includes(name));

const lines = [
  '# Vanilla Java 26.2 Coverage Audit',
  '',
  'Generated from the official Mojang version manifest and the Java 26.2 client jar.',
  '',
  `- Official item definitions: ${officialItems.length}`,
  `- Official item definitions after generated model filtering: ${filteredOfficialItems.length}`,
  `- Repo base item definitions: ${items.length}`,
  `- Missing item definitions: ${missingItems.length}`,
  `- Missing non-block item definitions: ${missingNonBlockItems.length}`,
  `- Official blockstate definitions: ${officialBlocks.length}`,
  `- Repo block definitions: ${blocks.length}`,
  `- Missing block implementations: ${missingBlocks.length}`,
  '',
  '## Missing Non-Block Items',
  '',
  ...missingNonBlockItems.map((name) => `- ${name} (${titleCase(name)})`),
  '',
  '## Missing Block Items',
  '',
  'These exist as vanilla item definitions, but the matching block implementation is also missing or incomplete in this project.',
  '',
  ...blockItemMissingImplementation.map((name) => `- ${name} (${titleCase(name)})`),
  '',
  '## Missing Block Implementations',
  '',
  ...missingBlocks.map((name) => `- ${name} (${titleCase(name)})`),
  '',
];

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);

console.log(`Official Java items: ${officialItems.length}`);
console.log(`Filtered official items: ${filteredOfficialItems.length}`);
console.log(`Repo item definitions: ${items.length}`);
console.log(`Missing item definitions: ${missingItems.length}`);
console.log(`Missing non-block item definitions: ${missingNonBlockItems.length}`);
console.log(`Official blocks: ${officialBlocks.length}`);
console.log(`Repo block definitions: ${blocks.length}`);
console.log(`Missing block implementations: ${missingBlocks.length}`);
console.log(`Wrote ${reportPath}`);
