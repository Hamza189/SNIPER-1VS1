# NEXT LEVEL — pruebas jugando (Etapa 0)

Entorno: PC del propietario (MSI GF63, GTX 1050 Ti Max-Q), navegador integrado de Claude con la GPU real, juego local
(`main` con los arreglos `e3fdc49` y `43bd0da`), ventana pequeña (~800×730). Los controles se manejan por los ganchos
de prueba `__SD` (no con ratón ni teclado físicos). **Nada de esto es una prueba en iPhone.**
Clasificación: CONFIRMADO · PROBABLE · HIPÓTESIS · PENDIENTE DE PRUEBA.

## Sesión 1 (18-10-2026, con poco uso disponible)

### CASA ATLAS (`?casa=1`), duelo contra 1 bot
| Observación | Estado | Evidencia |
|---|---|---|
| El mapa es de **corta distancia**: línea de visión media **6,1 m**, máxima **18,6 m**; solo el **1 %** de las líneas de visión supera 15 m; el 52 % de los pares de puntos se ven entre sí | CONFIRMADO (MEDIDO) | 3 000 pares de puntos caminables al azar, rayo a 1,6 m contra las colisiones reales (`W.ray`) |
| Para un juego de francotiradores (HALCÓN con cero a 50 m, mira 4×/8×) el mapa no aprovecha el arma principal: se juega como un mapa de escopeta | CONFIRMADO (por la medida anterior) | — |
| Desde la aparición A se ve al bot a pocos metros, a través de dos puertas en línea | CONFIRMADO | Captura en la sesión |
| Paredes blancas lisas y sin relieve; sin techo se ve el cielo por encima de los muros (aspecto de decorado) | CONFIRMADO | Captura; coincide con `docs/ASSETS-3D.md` §17 |
| Al perder el foco la ventana, el juego pasa a «EN ESPERA» (pausa) | CONFIRMADO, comportamiento esperado | Captura |

### Pendiente de jugar en la próxima sesión
PUEBLO 3.0 a pie y desde la mira (corta/media/larga), las cuatro armas, bots FÁCIL/NORMAL/DIFÍCIL, CAMPO DE TIRO y
diagnóstico, ARENA, 1v1 con dos clientes (muerte, reaparición, victoria, revancha), táctil simulado, perfiles BAJO/MEDIO/ALTO.

## Propuesta: CASA ATLAS más grande (petición del propietario: 3–4 veces mayor)
- **No se puede escalar el modelo:** puertas, muebles y escaleras saldrían gigantes y las colisiones dejarían de cuadrar.
- **Objetivo de diseño (propuesta):** parcela de unos 40 × 32 m (≈ 5 veces el área actual de 18 × 14 m) con la casa
  actual intacta en el centro, más jardín/patio, calle delantera y un segundo edificio (garaje o casa de invitados).
  Líneas de visión de 25–45 m a través de ventanas y del patio, coberturas para cruzar, y rutas cortas por dentro de la
  casa para quien prefiera escopeta o pistola.
- **Forma de trabajo recomendada (la de los estudios): bloqueo → prueba → arte.**
  1. Claude construye primero una versión «gris» (cajas simples, colisiones exactas, bots, servidor) tras `?casa=2`.
  2. El propietario la juega y aprueba distancias y rutas.
  3. ChatGPT viste esa planta con modelos y texturas según el contrato (o Claude con el kit propio del PUEBLO 3.0 y
     texturas CC0 de Poly Haven), sin cambiar las colisiones aprobadas.
- **Requiere:** desplegar el servidor (mapa nuevo en `core/mapdata.js`) cuando el propietario lo apruebe. CASA actual
  (`?casa=1`) no se toca.
