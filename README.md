# SNIPER DUEL

Shooter PvP de francotiradores en el navegador, hecho con Three.js. Sin Unity ni Godot: se abre `index.html` y se juega.

**Fase actual:** 1 — gunplay y movimiento con un solo rifle (HALCÓN R7), duelo contra bots y campo de tiro a 20/50/100 m.

## Jugar

Abre `index.html` en el navegador (ordenador o móvil). Pulsa **F3** durante la partida para ver el panel técnico.

| Ordenador | Acción |
|---|---|
| W A S D | Moverse |
| Shift | Esprintar · con mira: aguantar la respiración |
| C | Agacharse · esprintando: slide |
| Espacio | Saltar |
| Q / E | Asomarse |
| Clic derecho | Mira (mantener) |
| Rueda | Zoom 4× / 8× |
| Clic izquierdo | Disparar |
| R | Recargar |

En móvil hay joystick y botones en pantalla.

## Estructura

```
core/            Lógica pura y determinista (sin Three.js), reutilizable por un futuro servidor
  config.js      Todos los números que definen las sensaciones (movimiento, rifle, cámara)
  movement.js    Simulación del jugador: aceleración, sprint, crouch, slide, salto, colisiones, rampas
  weapon.js      Estados del arma, regla de precisión, balística con caída de bala, retroceso
src/page.html    Cliente: render, cámara, modelo del arma, efectos, audio, bots, interfaz, controles
build.py         Une core/ + src/page.html en index.html (un solo archivo)
test/            Pruebas automáticas en Node
docs/            Pruebas manuales y guía de ajuste de parámetros
```

La simulación corre a 120 Hz fijos (independiente de los FPS) con interpolación visual. El cliente convierte la entrada en un comando por tick; el futuro servidor autoritativo podrá ejecutar los mismos `core/movement.js` y `core/weapon.js` con esos comandos y validar los disparos.

## Desarrollo

Requisitos: Python 3 y Node.js 18 o superior. No hay dependencias que instalar.

```
python3 build.py        # genera index.html
npm test                # build + pruebas automáticas
```

- `test/core.test.js` — 69 comprobaciones de movimiento, arma, balística y retroceso.
- `test/smoke.test.js` — 22 comprobaciones del juego completo con Three.js y la página sustituidos por imitaciones (no prueba lo visual).

Edita `core/` o `src/page.html`, nunca `index.html` directamente: se regenera con `build.py`.

Las pruebas que hay que hacer jugando están en [`docs/PRUEBAS-Y-AJUSTES.md`](docs/PRUEBAS-Y-AJUSTES.md).

## Hoja de ruta

1. **Gunplay** (actual) · 2. Segundo rifle · 3. 1v1 online con sala privada y código · 4. Salas 2v2 / 3v3
