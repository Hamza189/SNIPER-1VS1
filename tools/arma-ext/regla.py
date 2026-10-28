"""Dibuja una regla en centímetros sobre la vista de lado de arma.py (modo medir): eje horizontal = distancia a la
boca del cañón, eje vertical = distancia bajo lo más alto del arma. Uso: python regla.py <dir>"""
import sys, json
from PIL import Image, ImageDraw
d = sys.argv[1]; J = json.load(open(d + '/lado.json')); im = Image.open(d + '/lado.png').convert('RGB')
W, H, span = J['w'], J['h'], J['span']; k = W / span          # px por metro
def px(y, z):   # y del modelo (boca en 0, hacia la culata negativo) → la boca a la izquierda
    return W / 2 + (J['cy'] - y) * k, H / 2 - (z - J['cz']) * k
g = ImageDraw.Draw(im)
for c in range(0, int(J['len'] * 100) + 1, 5):           # cada 5 cm a lo largo
    x, _ = px(-c / 100, 0); col = (255, 200, 0) if c % 10 == 0 else (120, 100, 0)
    g.line([(x, 0), (x, H)], fill=col, width=1)
    if c % 10 == 0: g.text((x + 2, 2), str(c), fill=(255, 220, 80))
for c in range(0, int(J['height'] * 100) + 1, 2):        # cada 2 cm hacia abajo
    _, y = px(0, -c / 100); col = (0, 200, 255) if c % 10 == 0 else (0, 90, 120)
    g.line([(0, y), (W, y)], fill=col, width=1)
    if c % 10 == 0: g.text((2, y + 1), str(c), fill=(80, 220, 255))
im.save(d + '/regla.png')
# desde arriba: x del modelo (derecha +) hacia abajo en la imagen; líneas cada 1 cm desde el centro
im2 = Image.open(d + '/arriba.png').convert('RGB'); g2 = ImageDraw.Draw(im2)
for c in range(0, int(J['len'] * 100) + 1, 5):
    x, _ = px(-c / 100, 0); g2.line([(x, 0), (x, H)], fill=(255, 200, 0) if c % 10 == 0 else (120, 100, 0), width=1)
    if c % 10 == 0: g2.text((x + 2, 2), str(c), fill=(255, 220, 80))
for c in range(-12, 13):
    y = H / 2 + (c / 100) * k; g2.line([(0, y), (W, y)], fill=(0, 200, 255) if c == 0 else (0, 70, 100), width=1)
    if c % 2 == 0: g2.text((2, y + 1), ('+' if c > 0 else '') + str(c), fill=(80, 220, 255))
im2.save(d + '/regla_arriba.png'); print('regla', d, 'px/cm', round(k / 100, 2))
