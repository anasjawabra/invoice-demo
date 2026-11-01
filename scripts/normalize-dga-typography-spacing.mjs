import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const checkOnly = process.argv.includes('--check');

const spacingTokens = [
  [4, '--spacing-xs'],
  [8, '--spacing-md'],
  [12, '--spacing-lg'],
  [16, '--spacing-xl'],
  [20, '--spacing-2xl'],
  [24, '--spacing-3xl'],
  [32, '--spacing-4xl'],
  [40, '--spacing-5xl'],
  [48, '--spacing-6xl'],
  [64, '--spacing-7xl'],
  [80, '--spacing-8xl'],
  [96, '--spacing-9xl'],
  [128, '--spacing-10xl'],
  [160, '--spacing-11xl']
];

const typeTokens = [
  [10, '--text-2xs'],
  [12, '--text-xs'],
  [14, '--text-sm'],
  [16, '--text-md'],
  [18, '--text-lg'],
  [20, '--text-xl'],
  [24, '--display-xs'],
  [30, '--display-sm'],
  [36, '--display-md']
];

function nearestToken(value, tokens) {
  return tokens.reduce((best, candidate) => (
    Math.abs(candidate[0] - value) < Math.abs(best[0] - value) ? candidate : best
  ));
}

function spacingVar(raw) {
  const value = Number(raw);
  if (value === 0) return '0';
  return `var(${nearestToken(value, spacingTokens)[1]})`;
}

function typeVar(raw) {
  return `var(${nearestToken(Number(raw), typeTokens)[1]})`;
}

function normalizeJsx(source) {
  let next = source;
  next = next.replace(/fontSize:\s*(\d+(?:\.\d+)?)/g, (_, size) => `fontSize: '${typeVar(size)}'`);
  next = next.replace(/fontWeight:\s*(800|850|900)/g, 'fontWeight: 700');

  const spacingProperty = '(?:gap|rowGap|columnGap|marginTop|marginBottom|marginInlineStart|marginInlineEnd|padding|paddingInline|paddingInlineStart|paddingInlineEnd|paddingBlock|paddingBlockStart|paddingBlockEnd)';
  next = next.replace(new RegExp(`(${spacingProperty}):\\s*(\\d+(?:\\.\\d+)?)`, 'g'), (_, property, value) => `${property}: '${spacingVar(value)}'`);
  next = next.replace(new RegExp(`(${spacingProperty}):\\s*'([^']*\\d+(?:\\.\\d+)?px[^']*)'`, 'g'), (_, property, value) => {
    const normalized = value.replace(/(\d+(?:\.\d+)?)px/g, (match, size) => spacingVar(size));
    return `${property}: '${normalized}'`;
  });
  return next;
}

function normalizeCss(source) {
  let next = source;
  next = next.replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (_, size) => `font-size: ${typeVar(size)}`);
  next = next.replace(/font-weight:\s*(800|850|900)/g, 'font-weight: 700');

  const spacingProperty = '(?:gap|row-gap|column-gap|margin|margin-top|margin-bottom|margin-inline-start|margin-inline-end|padding|padding-inline|padding-inline-start|padding-inline-end|padding-block|padding-block-start|padding-block-end)';
  next = next.replace(new RegExp(`(${spacingProperty}):\\s*([^;{}]+)`, 'g'), (match, property, value) => {
    const normalized = value.replace(/(\d+(?:\.\d+)?)px/g, (_, size) => spacingVar(size));
    return `${property}: ${normalized}`;
  });
  return next;
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (['.jsx', '.css'].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

let changedFiles = 0;
for (const file of await filesUnder(root)) {
  const source = await readFile(file, 'utf8');
  const next = extname(file) === '.css' ? normalizeCss(source) : normalizeJsx(source);
  if (next !== source) {
    changedFiles += 1;
    if (!checkOnly) await writeFile(file, next, 'utf8');
  }
}

console.log(JSON.stringify({ checkOnly, changedFiles }));
