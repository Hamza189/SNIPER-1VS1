/* Sube los archivos grandes del juego a Cloudflare R2 (docs/R2.md), por el Worker sniper-duel-assets.
   Solo sube lo que ha cambiado: compara el MD5 del archivo con la etiqueta (etag) que ya tiene R2.
   La clave de subida está en .work/r2-clave.txt (fuera de git) y en el secreto R2_UPLOAD_KEY de GitHub.
   Run: node tools/r2-subir.js                 todo lo de R2_FILES (texturas KTX2 de personajes y armas)
        node tools/r2-subir.js <archivo>...    solo esos (rutas desde la raíz del repositorio, assets/...) */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const URL0 = process.env.R2_URL || 'https://sniper-duel-assets.hamzaimtiaz2015.workers.dev/';
// what lives in R2 and not in the repository (also in .gitignore)
const R2_FILES = [/^assets\/personaje\/.*_ktx2\.(glb|ktx2)$/, /^assets\/armas\/[^/]+\/arma_ktx2\.glb$/, /^assets\/armas\/[^/]+\/ktx2\/[^/]+\.ktx2$/];

function walk(d, out) {
  for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    const p = d + '/' + e.name;
    if (e.isDirectory()) walk(p, out); else if (R2_FILES.some(r => r.test(p))) out.push(p);
  }
  return out;
}

(async () => {
  const key = fs.readFileSync(path.join(ROOT, '.work/r2-clave.txt'), 'utf8').trim();
  const files = process.argv.length > 2 ? process.argv.slice(2).map(f => f.replace(/\\/g, '/')) : walk('assets', []);
  let up = 0, same = 0, bytes = 0, bad = 0;
  for (const f of files) {
    const buf = fs.readFileSync(path.join(ROOT, f)), md5 = crypto.createHash('md5').update(buf).digest('hex');
    const h = await fetch(URL0 + f, { method: 'HEAD' }).catch(() => ({}));
    if (h.ok && (h.headers.get('etag') || '').replace(/"/g, '') === md5) { same++; continue; }
    for (let t = 1; ; t++) {
      // (home connections drop now and then in the middle of a big file: try again)
      const r = await fetch(URL0 + f, { method: 'PUT', body: buf, headers: { 'x-clave': key, 'content-length': String(buf.length) } }).catch(e => ({ status: e.cause && e.cause.code || e.message }));
      if (r.ok) { const j = await r.json(); if (j.etag !== md5) { console.log('  MAL  ' + f + ' (etag distinto)'); bad++; } else { up++; bytes += buf.length; console.log('  sube ' + f + '  ' + (buf.length / 1048576).toFixed(1) + ' MB'); } break; }
      if (t >= 5 || r.status === 403) { console.log('  FALLA ' + f + ' (' + r.status + ')'); bad++; break; }
    }
  }
  console.log('\n' + up + ' subidos (' + (bytes / 1048576).toFixed(0) + ' MB), ' + same + ' ya estaban, ' + bad + ' con fallos');
  process.exit(bad ? 1 : 0);
})();
