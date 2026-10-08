# SNIPER DUEL

Shooter PvP de francotiradores en el navegador, hecho con Three.js. Sin Unity ni Godot: se abre `index.html` y se juega.

**Fase actual:** 2A — rifle HALCÓN R7 + navaja táctica, duelo contra bots y campo de tiro (dianas a 20/50/100 m y bots de entrenamiento desarmados).

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
| 1 / 3 | Rifle / navaja |
| F | Inspeccionar navaja |

En móvil hay joystick y botones en pantalla (ARMA cambia entre rifle y navaja).

## Estructura

```
core/            Lógica pura y determinista (sin Three.js), reutilizable por un futuro servidor
  config.js      Todos los números que definen las sensaciones (movimiento, rifle, cámara)
  movement.js    Simulación del jugador: aceleración, sprint, crouch, slide, salto, colisiones, rampas
  weapon.js      Estados del arma, regla de precisión, balística con caída de bala, retroceso
  melee.js       Cambio de arma, navaja, golpe cuerpo a cuerpo (alcance, paredes, espalda), animaciones
  trainer.js     Cerebro de los bots de entrenamiento (mismos comandos que un jugador)
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
- `test/phase2.test.js` — 58 comprobaciones de navaja, cambio de arma y bots de entrenamiento.
- `test/smoke.test.js` — 57 comprobaciones del juego completo con Three.js y la página sustituidos por imitaciones (no prueba lo visual).

Edita `core/` o `src/page.html`, nunca `index.html` directamente: se regenera con `build.py`.

Las pruebas que hay que hacer jugando están en [`docs/PRUEBAS-Y-AJUSTES.md`](docs/PRUEBAS-Y-AJUSTES.md).

## Hoja de ruta

1. Gunplay ✔ · 2A. **Navaja y entrenamiento** (actual) · 2B. Controles móviles · 3. 1v1 online con sala privada y código · 4. Salas 2v2 / 3v3
