/**
 * Generates public/og.png (1200x630) from an SVG via sharp.
 * Run once via `npm run og`; the output is committed.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d3528"/>
      <stop offset="1" stop-color="#0e1a13"/>
    </linearGradient>
    <linearGradient id="ember" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f09a55"/>
      <stop offset="1" stop-color="#e07b39"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g opacity="0.06" stroke="#e8e0cc" fill="none" stroke-width="1.5">
    <circle cx="1030" cy="140" r="180"/><circle cx="1030" cy="140" r="130"/><circle cx="1030" cy="140" r="85"/><circle cx="1030" cy="140" r="45"/>
    <circle cx="160" cy="520" r="150"/><circle cx="160" cy="520" r="105"/><circle cx="160" cy="520" r="65"/>
  </g>
  <g transform="translate(72,86)">
    <path d="M22 4 C26 7 28 12 27 17 C26 22 21 26 15 26 C16 21 15 16 11 14 C14 12 14 8 13 5 C16 6 19 5 22 4 Z" fill="#e07b39" transform="scale(1.6)"/>
    <path d="M6 26 L13 19" stroke="#e8e0cc" stroke-width="2.5" stroke-linecap="round" transform="scale(1.6)"/>
    <circle cx="19" cy="12" r="2" fill="#e8e0cc" transform="scale(1.6)"/>
  </g>
  <text x="72" y="300" font-family="Arial Narrow, Arial, sans-serif" font-size="118" font-weight="700" fill="#e8e0cc" letter-spacing="4">HUNTER<tspan fill="#f09a55">FORGE</tspan></text>
  <rect x="76" y="336" width="330" height="6" fill="url(#ember)"/>
  <text x="74" y="408" font-family="Arial, sans-serif" font-size="36" fill="#b7ae97">Monster Hunter Wilds build &amp; skill calculators</text>
  <text x="74" y="466" font-family="Consolas, Menlo, monospace" font-size="26" fill="#e07b39">armor set builder · deco planner · effective raw</text>
  <g font-family="Consolas, Menlo, monospace" font-size="24" fill="#8b8471">
    <rect x="74" y="510" width="248" height="46" rx="23" fill="none" stroke="#8b8471" stroke-dasharray="6 5"/>
    <text x="102" y="539">snapshot 2026-10-11</text>
    <rect x="338" y="510" width="200" height="46" rx="23" fill="none" stroke="#8b8471"/>
    <text x="362" y="539">game-file data</text>
    <rect x="554" y="510" width="150" height="46" rx="23" fill="none" stroke="#8b8471"/>
    <text x="578" y="539">cited values</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(ROOT, 'public', 'og.png'));
console.log('wrote public/og.png');
