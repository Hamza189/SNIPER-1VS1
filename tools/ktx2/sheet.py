"""Hoja de comparación KTX2 (docs/KTX2.md): junta las imágenes de tools/ktx2/compare.js (JPG | KTX2 | diferencia ×8)
y mide cuánto se parecen (PSNR en dB: por encima de 40 la diferencia no se ve a simple vista).
  python3 tools/ktx2/sheet.py <carpeta de compare.js> [op2 op3 op4 soldado]  → docs/img/ktx2-comparacion.jpg
  python3 tools/ktx2/sheet.py --armas .work/ktx2-armas  → docs/img/ktx2-armas.jpg (de tools/ktx2/armas-compare.js: el
                                                          rifle en 1ª persona y un detalle ampliado, JPG 2K | KTX2)"""
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


ARMAS = {'titan': 'TITÁN (4K y 2K)', 'ultima': 'ÚLTIMA (4K)', 'vector': 'VECTOR (4K)', 'sahara': 'SAHARA (2K)'}


def font():
    """a font with Spanish letters (Ú, ª) when the system has one; Pillow's own otherwise"""
    from PIL import ImageFont
    for f in ('C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, 15)
    return None


def armas(d):
    rows, F = [], font()
    for k, name in ARMAS.items():
        fa, fb = os.path.join(d, k + '_jpg.png'), os.path.join(d, k + '_ktx2.png')
        if not (os.path.exists(fa) and os.path.exists(fb)): continue
        A, B = Image.open(fa).convert('RGB'), Image.open(fb).convert('RGB')
        W, H = A.size
        rifle = (int(W * 0.55), int(H * 0.47), W, H)                        # the rifle in first person
        zoom = (int(W * 0.62), int(H * 0.60), int(W * 0.82), int(H * 0.82))  # its receiver, enlarged ×3
        row = Image.new('RGB', (1440, 30 + 480 + 30 + 480), (15, 13, 10)); g = ImageDraw.Draw(row)
        p = psnr(np.asarray(A.crop(rifle)), np.asarray(B.crop(rifle)))
        g.text((8, 8), '%s · el rifle en 1ª persona · JPG 2K (lo de antes) | KTX2 a la resolución del original · PSNR %.1f dB' % (name, p), fill=(244, 234, 216), font=F)
        for i, im in enumerate((A, B)): row.paste(im.crop(rifle).resize((720, 480), Image.LANCZOS), (720 * i, 30))
        g.text((8, 518), 'detalle ampliado x3 (como con la cara pegada al arma)', fill=(244, 234, 216), font=F)
        for i, im in enumerate((A, B)): row.paste(im.crop(zoom).resize((720, 480), Image.LANCZOS), (720 * i, 540))
        rows.append(row); print('%s: PSNR del rifle %.1f dB' % (name, p))
    sheet = Image.new('RGB', (1440, sum(r.height for r in rows)), (15, 13, 10)); y = 0
    for r in rows: sheet.paste(r, (0, y)); y += r.height
    out = os.path.join(ROOT, 'docs', 'img', 'ktx2-armas.jpg'); sheet.save(out, quality=88)
    print('-> ' + os.path.relpath(out, ROOT))


if __name__ == '__main__':
    armas(sys.argv[2]) if sys.argv[1] == '--armas' else main()
