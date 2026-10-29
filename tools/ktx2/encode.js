/* Codificador KTX2 por lotes (texturas comprimidas en la GPU; docs/KTX2.md). Usa el codificador oficial de Basis
   Universal v1.50 (tools/ktx2/basis, Apache 2.0, compilado a WebAssembly; funciona en Node sin instalar nada).
   Cada textura sale en UASTC 4×4 (la calidad alta de Basis: la GPU la recibe como ASTC en el iPhone, BC7 en PC; 1 byte
   por píxel en vez de 4) con mipmaps y supercompresión zstd para la descarga.
     node tools/ktx2/encode.js trabajos.json
     trabajos.json = [{ "in": "a.png", "out": "a.ktx2", "kind": "srgb" | "linear" | "normal", "rdo": 1.0 }, ...]
   kind: srgb = color (curva sRGB, error perceptual); linear = rugosidad/metal; normal = mapa de normales.
   rdo: optimización tasa-distorsión de UASTC (0 = sin ella; 1 = el valor por defecto de Basis: archivos ~30 % menores
   con una pérdida muy pequeña; más alto = más pequeño y menos fiel). */
'use strict';
const fs = require('fs'), path = require('path');
const BASIS = require(path.join(__dirname, 'basis', 'basis_encoder.js'));

(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const M = await BASIS({ locateFile: f => path.join(__dirname, 'basis', f) });
  M.initializeBasis();
  for (const j of jobs) {
    const t0 = Date.now(), png = fs.readFileSync(j.in);
    const enc = new M.BasisEncoder();
    enc.setCreateKTX2File(true);
    enc.setKTX2UASTCSupercompression(true);
    enc.setUASTC(true);
    enc.setPackUASTCFlags(j.level == null ? 2 : j.level);   // 2 = el nivel por defecto de Basis (buena calidad, tiempo razonable)
    const srgb = j.kind === 'srgb';
    enc.setKTX2SRGBTransferFunc(srgb); enc.setPerceptual(srgb); enc.setMipSRGB(srgb);
    if (j.kind === 'normal') enc.setNormalMap();
    enc.setRDOUASTC(j.rdo > 0); if (j.rdo > 0) enc.setRDOUASTCQualityScalar(j.rdo);
    enc.setMipGen(true);
    enc.setSliceSourceImage(0, new Uint8Array(png), 0, 0, true);
    const out = new Uint8Array(64 * 1024 * 1024), n = enc.encode(out);
    enc.delete();
    if (!n) { console.error('FALLO ' + j.in); process.exitCode = 1; continue; }
    fs.writeFileSync(j.out, Buffer.from(out.buffer, 0, n));
    console.log(path.basename(j.out) + ' · ' + (n / 1048576).toFixed(2) + ' MB · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  }
})().catch(e => { console.error(e); process.exit(1); });
