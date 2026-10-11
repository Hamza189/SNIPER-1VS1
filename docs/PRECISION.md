# Auditoría de precisión — HALCÓN R7 y bots

Todo lo medido sale del motor real del juego. Herramientas:

- `tools/aim-audit.js`: navegador, Three.js real, campo de tiro, pantalla de 844 × 390 (iPhone en horizontal).
- `tools/bot-motion-audit.js`: el mismo código de movimiento de los bots, en Node.

Tests: `test/aim.browser.test.js` (14 comprobaciones) y `test/phase2.test.js` (movimiento de los bots).
Estado: PROBADO EN NAVEGADOR (escritorio) · PENDIENTE DE VALIDACIÓN EN IPHONE.

## Lo que funciona como debe

| Comprobación | Resultado |
|---|---|
| Centro del visor = dirección del disparo | 0,0000 mrad. La retícula está en el centro exacto de la imagen (0 px) |
| Retícula en cabeza / torso / piernas de dianas quietas a 26 y 56 m (balanceo quitado) | 6/6 en la parte apuntada |
| Dispersión con el visor puesto | 0: el tiro sale exactamente por la retícula |
| Retroceso | Solo visual; no cambia la bala |
| Cero a 50 m | +1,4 cm a 26 m · −0,7 cm a 56 m · −12,5 cm a 105 m: la caída es intencionada |
| Zonas de impacto del rival online (las mismas del servidor) | A ≤ 10 cm del soldado visible en todas las posturas |

## Errores reales encontrados y corregidos

1. **Las marcas del visor no correspondían a nada.**
   - Las tres marcas bajo el centro equivalían a 9 / 15 / 21 mrad: la primera era para 465 m, no para 100 m. Quien
     apuntase con ella a 100 m tiraba ~80 cm alto.
   - Las laterales iban cada 6 mrad y no coincidían con ningún adelanto.
   - **Ahora** se calculan para la pantalla y el zoom reales:
     - bajo el centro, 100 / 150 / 200 m, con la caída real (1,09 / 2,18 / 3,27 mrad);
     - a los lados, el adelanto para un objetivo agachado (2,4 m/s), andando (4,6 m/s, marca **A**) y corriendo (7 m/s,
       marca **C**): 4,0 / 7,7 / 11,7 mrad.
     - El adelanto en ángulo es el mismo a cualquier distancia (v / 600).
2. **La zona de impacto de los bots de entrenamiento se quedaba arriba al deslizarse.** Estaba a 53–56 cm de la
   cabeza visible.
   - Ahora sigue la altura de los ojos, con la misma regla que el servidor aplica al jugador.
   - El cuerpo baja y sube gradualmente, en lugar de saltar.
   - Peor caso medido: ≤ 15 cm. En el rival online, al deslizarse, se pasa de 10 a 4 cm.
3. **Los bots del duelo giraban en un solo tick** en cada nodo de su ruta: hasta 816 m/s² de aceleración, giros y
   paradas instantáneos.
   - Ahora el giro tiene aceleración limitada (9 m/s²) y la curva empieza antes del nodo.
   - Mismos 3,4 m/s; frenan para apuntar.
4. **Los bots de entrenamiento cambiaban de dirección de golpe** al elegir un destino nuevo o un nuevo comportamiento:
   en NORMAL, el 5,8 % de los cambios llegaba antes del tiempo mínimo de su nivel; en DIFÍCIL, el 4,2 %.
   - Ahora es el 0,3 %: el nuevo plan conserva la dirección lateral actual.
   - Al llegar al borde de la zona se dan la vuelta, como haría cualquiera.

## Lo que hace difícil acertar (medido; es intencionado, no se ha cambiado)

| Factor | Medida |
|---|---|
| Balanceo de la mira sin aguantar el aire | ±4,9 mrad → **±24 cm a 50 m, ±49 cm a 100 m** (una cabeza: ±15 cm) |
| Aguantando el aire (3,5 s) | ±0,1 mrad |
| Cansado (tras agotar el aire) | ±8,4 mrad |
| Agachado | ±2,6 mrad |
| Andando con la mira | ±9,6 mrad |
| Disparar antes de que aparezca el visor (< 170 ms tras pulsar MIRA) | Cono de 22–50 mrad = ±1,1–2,5 m a 50 m |
| Objetivo en movimiento (bala a 600 m/s) | Adelanto de 26 cm a 50 m a 2,8 m/s; 38 cm andando a 4,6 m/s. Diana móvil a 57 m: **0/6 sin adelanto, 5/6 con adelanto** |
| Sensibilidad táctil con mira 8× (valores por defecto) | 1 px de dedo = 1,29 mrad = 6,4 cm a 50 m; **la imagen se mueve 3,3 px por cada px de dedo**. Una cabeza mide 15 px a 50 m y 8 px a 100 m |
| Botón AIRE en el móvil | Solo aparece con el visor puesto, y es un tercer botón: con MIRA en un pulgar y FUEGO en el otro, es casi imposible usarlo |

Conclusión: la dificultad no viene de un fallo de alineación. Viene de cuatro cosas que se suman:

1. Balanceo grande sin aguantar el aire, que en el móvil apenas se puede aguantar.
2. Sensibilidad alta con la mira en el móvil.
3. Adelanto necesario sin marcas útiles: lo segundo ya está corregido.
4. Tiros antes de que aparezca el visor.

## Propuestas pendientes de aprobación (no aplicadas)

- **Sensibilidad con mira en táctil**: bajar `adsSens` de 1,3 a ~0,8, para que la imagen se mueva unos 2 px por px de
  dedo en lugar de 3,3. Se puede probar ya en AJUSTES → SENSIBILIDAD.
- **Aguantar el aire en táctil**: hacerlo automático mientras el dedo de MIRA está quieto, o mientras se mantiene FUEGO
  con "disparar al soltar". Cambia el equilibrio táctil/PC: es decisión de diseño.
- **Esperar al visor**: si se pulsa FUEGO con MIRA mantenida antes de que salga el visor, que el disparo espere a que
  salga (≤ 170 ms) en vez de ir con dispersión.
- **Rival online deslizándose**: 10 → 4 cm ya aplicado en el dibujo. Las zonas del servidor no se han tocado.

## Diagnóstico de tiro (CAMPO DE TIRO → "Diagnóstico de tiro")

Solo funciona en el campo de tiro. Está desactivado en partidas contra bots y online, así que no da ventaja.

- **Lo que se dibuja:** la trayectoria real de la última bala, dónde terminó, el bot en la posición que tenía al
  disparar (fantasma) y las zonas de impacto de todos los bots.
- **El panel muestra:**
  - visor sí/no, ADS, dispersión, balanceo y tu velocidad;
  - el objetivo, su distancia, su velocidad (total y lateral) y el tiempo de vuelo;
  - en directo, lo que hay en la mira, con el adelanto y la caída necesarios.
- **El motivo de cada fallo** se decide repitiendo el tiro:

| Motivo | Cuándo |
|---|---|
| OBSTÁCULO | La bala chocó con el escenario antes de llegar al objetivo |
| MOVIMIENTO DEL OBJETIVO | Con el bot quieto habría acertado; indica cuánto se movió y cuánto adelantar |
| DISPERSIÓN | Disparo sin visor; la retícula sí estaba en el cuerpo |
| TRAYECTORIA | La línea recta de la retícula daba, pero la bala pasa por debajo o por encima por la caída |
| APUNTADO | La retícula estaba fuera del cuerpo; indica a cuántos cm y si el balanceo influyó |

**Sincronización online:** el diagnóstico no funciona en partidas online. Para eso sigue el panel técnico (F3), con el
último tiro "CORREGIDO" o "rechazado" del servidor.

## Entrenamiento

CAMPO DE TIRO → **Movimiento de los bots**:

| Opción | Comportamiento |
|---|---|
| LIBRE | El nivel elegido (fácil / normal / difícil) |
| QUIETOS | No se mueven |
| ANDAN | 2,3 m/s, tramos de 3–4,5 s con una pausa |
| CORREN | 7 m/s |
| LATERAL | 4,6 m/s, cambia cada 0,9–1,6 s |

Las estadísticas de precisión (disparos, impactos, % y cabezas) siguen en el marcador del campo de tiro.

## Cómo comprobarlo en el iPhone

1. CAMPO DE TIRO → activa **Diagnóstico de tiro**, bots **QUIETOS**.
   - Dispara con el visor a la cabeza de una diana a 50 m: debe decir IMPACTO.
   - Si dice APUNTADO con "el balanceo la movía…", aguanta el AIRE.
2. Bots **ANDAN** o **LATERAL**: pon la marca **A** de la retícula sobre el bot andando, en el lado hacia el que va.
   El panel dice cuánto adelanto hacía falta.
3. Apunta a una diana a 100 m con la marca **100** bajo el centro.
4. Anota cuántos fallos son APUNTADO, MOVIMIENTO o DISPERSIÓN. Con eso decidimos las propuestas de sensibilidad, aire y
   espera al visor.
