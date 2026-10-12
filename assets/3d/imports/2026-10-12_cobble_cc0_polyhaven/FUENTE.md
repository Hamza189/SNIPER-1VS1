# Cobblestone 02 — Poly Haven (CC0)

- **Fuente:** https://polyhaven.com/a/cobblestone_02
- **Autor:** Amal Kumar, Poly Haven
- **Licencia:** CC0 1.0 (dominio público): uso comercial permitido, sin atribución obligatoria
- **Ancho real del escaneo:** 1,8 m
- **Descarga:** la hizo el propietario en su PC el 12-10-2026 («4K, Blend»)
- **Archivos guardados aquí:** los mapas tal cual, en 4096²:
  - color (`diff`, JPEG sRGB);
  - normal OpenGL (`nor_gl`, EXR lineal codificado 0–1);
  - rugosidad (`rough`, EXR de un canal).
- **Archivos no guardados:** el desplazamiento (`disp`) y el `.blend`, porque el juego no los usa.
- **Preparador:** ChatGPT preparó un script de descarga (`Sniper_Duel_Cobble_CC0_Preparador.zip`). No hizo falta, porque el propietario trajo los originales.
- **Juego:** `tools/p0/make_p0cc_cobble.py` genera `assets/tex/p0cc*_cobble_*.jpg`. Es una opción con `?pueblo=3&adoquin=cc0`.
- **Color:** `cobblestone_02_diff_2k.png` es el PNG 2K sin pérdida de Poly Haven. Lo descargó el propietario con el preparador de ChatGPT y es la fuente del color, porque el JPEG 4K tiene una deriva de +7 en el verde.
- **Defecto del preparador de ChatGPT:** su rugosidad sale blanca entera (255 en toda la imagen). El PNG de rugosidad de Poly Haven es de 16 bits y `convert('RGB')` lo satura. Se usa el EXR, que da una media de 0,80 y va de 0,69 a 0,89.
