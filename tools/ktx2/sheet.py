"""Hoja de comparación KTX2 (docs/KTX2.md): junta las imágenes de tools/ktx2/compare.js (JPG | KTX2 | diferencia ×8)
y mide cuánto se parecen (PSNR en dB: por encima de 40 la diferencia no se ve a simple vista).
  python3 tools/ktx2/sheet.py <carpeta de compare.js> [op2 op3 op4 soldado]  → docs/img/ktx2-comparacion.jpg"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NAMES = {'op2': 'S.W.A.T. (4K)', 'op3': 'FSB (4K)', 'op4': 'MILITAR (2K)', 'soldado': 'SOLDADO (2K)'}


def psnr(a, b):
    mse = np.mean((a.astype(np.float64) - b.astype(np.float64)) ** 2)
    return 99.0 if mse == 0 else 10 * np.log10(255.0 ** 2 / mse)


def main():
    d = sys.argv[1]
    packs = [a for a in sys.argv[2:] if a in NAMES] or [k for k in NAMES if os.path.exists(os.path.join(d, k + '_body_ktx2.png'))]
    rows, report = [], []
    for k in packs:
        for v in ('body', 'face'):
            A = np.asarray(Image.open(os.path.join(d, '%s_%s_jpg.png' % (k, v))).convert('RGB'))
            B = np.asarray(Image.open(os.path.join(d, '%s_%s_ktx2.png' % (k, v))).convert('RGB'))
            p = psnr(A, B); report.append('%s %s: PSNR %.1f dB' % (NAMES[k], 'cuerpo' if v == 'body' else 'de cerca', p))
            D = np.clip(np.abs(A.astype(np.int16) - B.astype(np.int16)) * 8, 0, 255).astype(np.uint8)
            row = Image.new('RGB', (480 * 3, 630), (15, 13, 10))
            for i, im in enumerate((A, B, D)): row.paste(Image.fromarray(im), (480 * i, 30))
            g = ImageDraw.Draw(row)
            g.text((8, 8), '%s · %s · JPG (lo de ahora) | KTX2 (comprimida en la GPU) | diferencia x8 · PSNR %.1f dB' % (NAMES[k], 'cuerpo entero' if v == 'body' else 'de cerca (como con la mira)', p), fill=(244, 234, 216))
            rows.append(row)
    sheet = Image.new('RGB', (480 * 3, 630 * len(rows)), (15, 13, 10))
    for i, r in enumerate(rows): sheet.paste(r, (0, 630 * i))
    out = os.path.join(ROOT, 'docs', 'img', 'ktx2-comparacion.jpg'); sheet.save(out, quality=88)
    print('\n'.join(report)); print('-> ' + os.path.relpath(out, ROOT))


if __name__ == '__main__':
    main()
