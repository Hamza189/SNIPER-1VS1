/* Runs every suite of `npm test` one after another WITHOUT stopping at the first failure, and prints a summary of all the
   failed checks at the end (npm test stops at the first suite that fails). Same list and order as package.json.
   Run: node tools/todas-las-pruebas.js [desde]     (desde = part of a suite's name: start there) */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const steps = pkg.scripts.test.split('&&').map(s => s.trim()).filter(s => s.startsWith('node test/'));
const from = process.argv[2];
let started = !from;
const summary = [];
const t0 = Date.now();
const build = spawnSync('node', ['tools/py.js', 'build.py'], { cwd: root, encoding: 'utf8' });
if (build.status !== 0) { console.log(build.stdout, build.stderr); process.exit(1); }
for (const step of steps) {
  if (!started) { if (step.includes(from)) started = true; else continue; }
  const args = step.split(/\s+/).slice(1);
  const t = Date.now();
  const r = spawnSync('node', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const fails = out.split(/\r?\n/).filter(l => /^\s*FAIL\b/.test(l) || /Error:|SyntaxError|TypeError/.test(l) && !/^\s*ok\b/.test(l));
  const tot = (out.match(/(\d+) correctas, (\d+) fallid?as?/) || out.match(/(\d+) correctas, (\d+) fallos/) || []);
  const line = args.join(' ') + ' · ' + (tot[0] || 'sin resumen') + ' · ' + Math.round((Date.now() - t) / 1000) + ' s' + (r.status ? ' · código ' + r.status : '');
  console.log((fails.length || r.status ? 'MAL  ' : 'bien ') + line);
  for (const f of fails.slice(0, 12)) console.log('       ' + f.trim().slice(0, 300));
  if (fails.length || r.status) summary.push({ line, fails });
}
console.log('\n==== ' + (summary.length ? summary.length + ' suites con fallos' : 'TODO BIEN') + ' · ' + Math.round((Date.now() - t0) / 60000) + ' min');
for (const s of summary) { console.log(s.line); for (const f of s.fails.slice(0, 12)) console.log('   ' + f.trim().slice(0, 300)); }
process.exit(summary.length ? 1 : 0);
