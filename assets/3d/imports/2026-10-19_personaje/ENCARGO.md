# Contrato de fabricación — 19-10-2026

Un personaje compartido, tres apariencias: A arena/ocre, B oliva/gris oscuro y bots gris/negro. Misma geometría, UV, esqueleto y animaciones. Entrega aislada; Claude integra. Sin cambios del juego, sin commits.

Prevalecen las aclaraciones posteriores al encargo: cabeza y casco dentro de la esfera de radio 0,15 m, centro 1,63 m; altura máxima 1,78 m. Crouch y slide incorporan la altura final; el integrador debe quitar el escalado externo únicamente para este modelo. Radio de cabeza constante en todas las posturas. Se usan los valores exactos de core/hitbox.js (lectura solamente), no los redondeos de la tabla.

Última decisión del propietario: walk_fwd/back/left/right y sprint permiten hasta 0,45 m de salida de piernas y pies respecto a la caja, solamente en el eje de marcha. Esto reemplaza la anterior decisión de zancada corta. No amplía las cajas del servidor: las partes visuales que salgan no reciben impactos. Cabeza y torso conservan el límite original; idle, aim, crouch y slide conservan sus cajas con tolerancia original de 0,04 m (cabeza sin tolerancia). Documentar los máximos medidos por clip, también la salida transversal.

El objetivo es contacto sin deslizamiento a las velocidades de referencia 4,6 y 7 m/s. La integración deberá ajustar el avance del clip a la velocidad real del jugador; una animación in-place por sí sola no puede garantizar contacto si se reproduce a una velocidad distinta.

28 clips, 30 fps con último subfotograma para duraciones exactas no múltiplos de 1/30. Tres LOD <=10000/4000/1500 triángulos, <=60 huesos, <=4 influencias, un material, texturas 1024, GLB sin compresión especial ni armas, sockets de manos +Z delante +Y arriba.

Estado: fabricación en curso. Ninguna afirmación de rendimiento en iPhone hasta medición en dispositivo real.
