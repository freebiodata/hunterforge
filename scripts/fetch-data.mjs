/**
 * Downloads the raw mhdb snapshots into data-raw/ (see generate-data.mjs).
 * Be a polite API citizen: sequential requests, no retry hammering.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const RAW = path.join(ROOT, 'data-raw');
fs.mkdirSync(RAW, { recursive: true });

const endpoints = [
  ['skills.json', 'skills'],
  ['armor.json', 'armor'],
  ['armor_sets.json', 'armor/sets'],
  ['decorations.json', 'decorations'],
  ['charms.json', 'charms'],
  ['weapons.json', 'weapons'],
];

const base = 'https://wilds.mhdb.io/en/';
for (const [file, ep] of endpoints) {
  const url = base + ep;
  process.stdout.write(`fetching ${url} ... `);
  const res = await fetch(url, { headers: { 'User-Agent': 'HunterForge-data-pipeline/1.0 (+https://hunterforge.top)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const json = await res.json();
  fs.writeFileSync(path.join(RAW, file), JSON.stringify(json));
  console.log(`${json.length} records`);
}
console.log('done.');
