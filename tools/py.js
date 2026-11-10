/* Ejecuta un script de Python con el intérprete que haya: python3 (Linux, CI y la copia del PC del propietario), python
   o «py -3» (Windows). T0 de docs/claude-code/SNIPER_DUEL_TECHNOLOGY_EVOLUTION.md: que `npm test` funcione igual en todas
   partes.   node tools/py.js build.py [args…] */
'use strict';
const { spawnSync } = require('child_process');
const args = process.argv.slice(2);
for (const [cmd, pre] of [['python3', []], ['python', []], ['py', ['-3']]]) {
  const r = spawnSync(cmd, pre.concat(args), { stdio: 'inherit' });
  if (r.error && r.error.code === 'ENOENT') continue;   // not installed: try the next one
  process.exit(r.status == null ? 1 : r.status);
}
console.error('No se encuentra Python 3 (python3, python o py -3).');
process.exit(1);
