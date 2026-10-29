/* Calidad de un KTX2 frente a su original (docs/KTX2.md): descomprime el nivel 0 con el transcodificador de Basis
   (el del codificador, tools/ktx2/basis) a RGBA y escribe los píxeles en bruto; tools/ktx2/quality.py mide el PSNR.
     node tools/ktx2/quality.js a.ktx2 salida.rgba   → imprime ancho y alto */
'use strict';
const fs = require('fs'), path = require('path');
const BASIS = require(path.join(__dirname, 'basis', 'basis_encoder.js'));

(async () => {
  const M = await BASIS({ locateFile: f => path.join(__dirname, 'basis', f) });
  M.initializeBasis();
  const f = new M.KTX2File(new Uint8Array(fs.readFileSync(process.argv[2])));
  if (!f.isValid() || !f.startTranscoding()) throw new Error('KTX2 no válido: ' + process.argv[2]);
  const RGBA32 = 13, w = f.getWidth(), h = f.getHeight();
  const dst = new Uint8Array(f.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32));
  if (!f.transcodeImage(dst, 0, 0, 0, RGBA32, 0, -1, -1)) throw new Error('no se pudo descomprimir');
  f.close(); f.delete();
  fs.writeFileSync(process.argv[3], dst);
  console.log(w + ' ' + h);
})().catch(e => { console.error(e); process.exit(1); });
