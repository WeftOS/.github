#!/usr/bin/env node
// Fills the facts block of profile/README.md from the WeftOS site's facts.json.
//
//   node scripts/update-profile.mjs                 fetch https://weftos.weavelogic.ai/facts.json
//   node scripts/update-profile.mjs --facts f.json  read a local file instead
//   node scripts/update-profile.mjs --check         exit 1 if the block would change
//
// Rewrites only the text between the facts markers. No dependencies (Node 20+).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const README = join(ROOT, 'profile/README.md');
const URL_DEFAULT = 'https://weftos.weavelogic.ai/facts.json';
const START = '<!-- facts:start -->';
const END = '<!-- facts:end -->';

const argv = process.argv.slice(2);
const check = argv.includes('--check');
const fi = argv.indexOf('--facts');
const source = fi >= 0 ? argv[fi + 1] : URL_DEFAULT;

async function load() {
  if (fi >= 0) return JSON.parse(readFileSync(source, 'utf8'));
  const res = await fetch(source, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
  return res.json();
}

const need = (f, k) => {
  if (f[k] === undefined) throw new Error(`facts.json has no "${k}"`);
  return f[k];
};

function block(f) {
  const v = need(f, 'version');
  return [
    `- Release [v${v}](https://github.com/WeftOS/weftos/releases/tag/v${v})`,
    `- ${need(f, 'crates')} workspace crates, ${need(f, 'published')} of them published to [crates.io](https://crates.io/crates/weftos)`,
    `- ${need(f, 'adrs')} architecture decision records`,
    `- ${need(f, 'weaver_commands')} \`weaver\` and ${need(f, 'weft_commands')} \`weft\` top-level commands`,
    `- ${need(f, 'cogs')} cogs in [WeftOS/weftos-cogs](https://github.com/WeftOS/weftos-cogs) (${need(f, 'cogs_release')}), and ${need(f, 'catalog').modules} modules and ${need(f, 'catalog').chips} chips in the hardware catalog`,
  ].join('\n');
}

const facts = await load();
const text = readFileSync(README, 'utf8');
const a = text.indexOf(START);
const b = text.indexOf(END);
if (a < 0 || b < a) throw new Error(`${README}: facts markers not found`);
const next = `${text.slice(0, a + START.length)}\n${block(facts)}\n${text.slice(b)}`;

if (next === text) {
  console.log('profile facts: unchanged');
} else if (check) {
  console.error('profile facts: out of date');
  process.exit(1);
} else {
  writeFileSync(README, next);
  console.log('profile facts: updated');
}
