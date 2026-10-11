// Dev-only: inspect mhdb snapshots (data-raw/*.json) while curating the site dataset.
import fs from 'node:fs';

const s = JSON.parse(fs.readFileSync('data-raw/skills.json'));
console.log('attack/crit related skills:');
s.filter((x) => /attack|criti/i.test(x.name)).forEach((x) => console.log(` - ${x.name} | kind: ${x.kind} | maxLv: ${x.ranks.length}`));
console.log();
const names = ["Agitator", "Weakness Exploit", "Critical Eye", "Master's Touch", 'Handicraft', 'Offensive Guard', 'Maximum Might', 'Latent Power', 'Burst', 'Adrenaline Rush', 'Coalescence', 'Peak Performance'];
console.log('popular skills check:');
for (const n of names) {
  const f = s.find((x) => x.name === n);
  console.log(` - ${n} -> ${f ? `${f.kind} maxLv ${f.ranks.length}` : 'NOT FOUND'}`);
}
console.log();
console.log('set-kind skills:', s.filter((x) => x.kind === 'set').map((x) => `${x.name}(${x.ranks.length})`).join(', '));
console.log();
console.log('weapon-kind skills count:', s.filter((x) => x.kind === 'weapon').length);
console.log('sample weapon-kind:', s.filter((x) => x.kind === 'weapon').slice(0, 6).map((x) => `${x.name} (max ${x.ranks.length})`).join(', '));
console.log();
const atk = s.find((x) => /attack boost/i.test(x.name));
if (atk) console.log('ATTACK BOOST ranks:', atk.ranks.map((r) => `Lv${r.level}: ${r.description}`).join(' | '));
const cb = s.find((x) => /critical boost/i.test(x.name));
if (cb) console.log('CRITICAL BOOST ranks:', cb.ranks.map((r) => `Lv${r.level}: ${r.description}`).join(' | '));
const we = s.find((x) => /weakness exploit/i.test(x.name));
if (we) console.log('WEAKNESS EXPLOIT ranks:', we.ranks.map((r) => `Lv${r.level}: ${r.description}`).join(' | '));
const ce = s.find((x) => /critical eye/i.test(x.name));
if (ce) console.log('CRITICAL EYE ranks:', ce.ranks.map((r) => `Lv${r.level}: ${r.description}`).join(' | '));
