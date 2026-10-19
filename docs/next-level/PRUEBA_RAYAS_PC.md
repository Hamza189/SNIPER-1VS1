# Prueba de las rayas en el portátil del propietario (MSI GF63: Intel UHD 630 + NVIDIA GTX 1050 Ti)

Objetivo: saber **qué** produce las rayas antes de cambiar nada. Cada paso dura un minuto. Hazlo siempre en el mismo
sitio: en PUEBLO 3.0, quieto, mirando una pared donde se vean las rayas (mejor a 20–50 m), y también con la mira 8×.
Para cada paso: **una captura** (y si puedes un vídeo de 5 s girando un poco la cámara).

Enlace base (cuando esté publicado): `https://hamza189.github.io/SNIPER-1VS1/?pueblo=3`

1. **¿Qué GPU usa Chrome?** AJUSTES › GRÁFICOS: haz captura de la línea de diagnóstico (pone «GPU: …»).
   - Si dice **Intel**, repite la prueba forzando la NVIDIA: Configuración de Windows › Sistema › Pantalla › Gráficos ›
     Google Chrome › «Alto rendimiento» (reinicia Chrome). Si las rayas desaparecen con la NVIDIA → es la GPU Intel.
2. Añade al enlace, de uno en uno, y apunta en cuál **desaparecen** las rayas:
   | Añadir | Si desaparecen, la causa es |
   |---|---|
   | `&sombras=0` | las sombras del sol |
   | `&near=0.2` | capas de pintura pegadas a la pared (z-fighting) |
   | `&sombrageo=1` | el fundido de sombra sigue el relieve de la textura |
   | `&kitsombra=0` | toldos/aleros que se sombrean a sí mismos |
   | `&sbias=-0.001` | precisión del mapa de sombras |
   | `&nm=0` | los mapas de relieve de las texturas |
3. `&dbg=sombra` pinta la luz del sol en colores (rojo = cuánto se aplica la sombra, verde = luz). Si las rayas se ven
   como franjas rojas/negras, son sombra.
4. Dime a qué distancia aparecen (el telémetro de la mira da los metros). **Más allá de 58 m no hay sombras**: si se
   ven allí, no son sombras.

Con esas capturas Claude corrige solo la causa real, detrás de una bandera, y la pasa a defecto cuando apruebes el
resultado en tu PC.
