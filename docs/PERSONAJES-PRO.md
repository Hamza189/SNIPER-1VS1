# Personajes realistas por calidad (`?pj=pro`)

Petición del propietario (26-10-2026): personajes realistas según la calidad gráfica, con el nº 4 para MEDIO, los nº 2 y
3 como personajes principales en ALTO con texturas 4K, y los muñecos actuales para BAJO de momento.

| Calidad | Personaje | Modelo original (Sketchfab, CC BY 4.0) | Triángulos (LOD0 / 1 / 2) | Texturas |
|---|---|---|---|---|
| ALTO · rival online | `assets/personaje/pro/op2` | «S.W.A.T. Operator - 4k Followers Special Remaster», Mateusz Woliński (jeandiz) | 36 600 / 12 000 / 3 000 | 4096 |
| ALTO · bots | `assets/personaje/pro/op3` | «FSB Operator», Mateusz Woliński (jeandiz) | 29 300 / 12 000 / 3 000 | 4096 |
| MEDIO · todos | `assets/personaje/pro/op4` | «Military tactical suit (LowPolyGameReady)», DanlyVostok | 20 000 / 7 000 / 2 000 | 2048 |
| BAJO | soldado de cajas de siempre | — | — | — |

Sin la bandera nada cambia. `?pj=2` (rev. 03) y `?pj=3` (LINCE) siguen como estaban.

## Licencia (por qué estos y no el Tactical Soldier de TurboSquid)
- Los tres son **CC BY 4.0**: se pueden usar, modificar y publicar (también con fines comerciales) citando al autor.
  Créditos en AJUSTES › GRÁFICOS, en `LICENSE` y en cada `assets/personaje/pro/*/CREDITOS.md`.
- El Tactical Soldier 02 de TurboSquid (gratis, licencia estándar) **no se puede publicar** en este juego: su licencia
  exige formatos cerrados (solo acepta exportaciones WebGL de Unity, Unreal o Lumberyard) y prohíbe que los jugadores
  puedan obtener el modelo. Nuestro juego carga `.glb` (formato abierto) desde un repositorio público. Modificarlo no
  cambia eso. Solo se usó como banco de pruebas interno del conversor (nada se subió).

## Cómo se convierten (`tools/personaje-ext`)
`python tools/personaje-ext/make.py op2|op3|op4` (busca el `.zip` de Sketchfab en Descargas):
1. `gltfread.py` lee el glTF sin Blender, en doble precisión y en la pose de la escena (Sketchfab guarda algunas poses de
   enlace a ~10^6 unidades por metro, donde los floats de 32 bits pierden centímetros).
2. `extract.py`: reconoce el esqueleto (Mixamo, Character Creator, Rigify), crea Spine2 si falta, deduce la orientación
   del propio esqueleto, quita las armas de exhibición y las gafas de visión nocturna, pasa los pesos a los 26 huesos del
   juego, pone las piernas rectas (pose de exhibición → tobillos a ±10,5 cm), acorta un poco las botas, mete con curvas
   suaves lo que sobresale de las zonas de impacto (bolsas, cinturón, rodilleras; la cabeza dentro de su esfera) y hace
   3 LOD con Blender. Las zonas de impacto del servidor **no se tocan**.
3. `atlas.py`: un solo material (como exige el juego), atlas a 4K/2K con más espacio para cara y manos, variantes de color.
4. El generador de la rev. 04 escribe el GLB con las 29 animaciones del juego, el agachado/deslizamiento y los LOD.
5. Comprobaciones: contrato GLB y `tools/check-character-hitbox.js` en los 3 LOD (los tres pasan).

## Medidas y avisos
- Mismas llamadas de dibujo que el personaje 3D anterior (1 material por LOD). Más triángulos en ALTO (hasta 36 600 por
  soldado de cerca; los LOD bajan a 12 000 y 3 000 de lejos).
- **Memoria en ALTO**: cada personaje 4K son ~255 MB de texturas en la GPU (color, normal y ORM con mipmaps); con rival
  y bots, ~500 MB. Va bien en el PC (GTX 1050 Ti, 4 GB). En el iPhone, AUTO usa MEDIO (op4, ~64 MB). Si en el iPhone
  se pone ALTO a mano, conviene medirlo con AJUSTES › GRÁFICOS › MEDIR RENDIMIENTO.
- Descarga: op2 15 MB, op3 12 MB (solo en ALTO), op4 5,6 MB (MEDIO).
- Pruebas: `node test/soldier2.test.js` (contrato y zonas de los tres), `node test/pro.browser.test.js` (ALTO, MEDIO, BAJO).

## Modo mezcla para comparar y medir (`?pj=mix`, 27-10-2026)
Petición del propietario: en una partida contra bots, los 4 tipos a la vez para compararlos y medir el rendimiento en el
iPhone y el PC. Con `?pj=mix` el duelo pasa a 4 bots (salvo CASA ATLAS, que es 1 contra 1):
bot 1 S.W.A.T. (op2) · bot 2 FSB (op3) · bot 3 Military suit (op4) · bot 4 el soldado de cajas de siempre.
Texturas según la calidad: ALTO 4K (op4 2K), MEDIO 2K, BAJO 1K. El rival online es el S.W.A.T.
Medir: `https://hamza189.github.io/SNIPER-1VS1/?pj=mix&medir=1` (el informe lleva «banderas pj=mix»).
Prueba: `node test/pro.browser.test.js` (ALTO, MEDIO y BAJO).

## Elegir personaje (27-10-2026)
Con `?pj=pro` o `?pj=mix`, en el menú (debajo de «Arma principal») y en la sala online aparece **Tu personaje**: un botón
con retrato que abre las 4 fichas (S.W.A.T., FSB, MILITAR, CLÁSICO). Se guarda en el dispositivo (`sniperduel_skin`).
- **Online**: mensaje `skin { id }` (lista cerrada en `core/protocol.js`: `clasico`, `swat`, `fsb`, `militar`). El
  servidor solo lo guarda y lo reenvía en la sala; no cambia reglas, armas ni zonas de impacto. En la sala se ve el
  personaje de cada uno, se puede cambiar hasta empezar, y el modelo del rival se precarga en la sala.
- Cada cliente dibuja al rival con **su** calidad: en MEDIO, S.W.A.T. y FSB a 2K; en BAJO con `?pj=pro`, el de cajas.
- Retratos: `assets/personaje/retratos/<id>.jpg` (480×600), dibujados con el propio motor: `node tools/skin-portraits.js`.
- Texturas: mientras llega el color de una variante se ve el del propio GLB (antes, negro) y al llegar se sube a la GPU.
  Con `?pj=mix` los cuatro personajes se cargan ya en el menú.
- Prueba: `node test/pro.browser.test.js` (sección ELEGIR PERSONAJE · ONLINE) y `node test/room.test.js`.

## Paso más natural (27-10-2026)
El propietario: «cuando caminan parece un poco falso». Medido con `node tools/gait-sheet.js op2|op3|op4` (hoja de
fotogramas de lado y de frente + cifras; WebGL por software):

| Caso (m/s reales del juego) | Antes | Después |
|---|---|---|
| Apuntando 2,3 | 93 pasos/min (correr a cámara lenta) | 130 pasos/min, zancada más corta, pie clavado |
| Bot fácil 2,76 | 112 pasos/min | 143 pasos/min |
| De lado 4,6 | 304 pasos/min con pasitos de 40 cm | 207 pasos/min, paso lateral largo con fase de vuelo, pie clavado (0,2–0,5 m/s) |
| Diagonal 4,6 | el pie patinaba 1,9 m/s | piernas giradas hacia la marcha, 0,15–0,2 m/s |
| Diagonal atrás 4,6 | — | 0,2–0,3 m/s |

Cómo:
1. `client/soldier2.js` (todos los personajes 3D): por debajo de la velocidad del clip la zancada se acorta y la cadencia
   baja con la raíz de la velocidad; por encima sube como mucho un 15 % (`gait`). Las piernas giran hacia donde se va
   (hasta 67,5° de frente, de lado entre 67,5° y 112,5°, hacia atrás el resto, con 8° de margen) y el pecho contragira:
   el arma y la mirada siguen al frente (`legPlan`). Agachado se gira como mucho 60° (más torsión no es humana).
2. Rev. 04 (`clips.py`/`anim.py`): `walk_left`/`walk_right` con zancada de 56 cm de apoyo (antes 40), fase de vuelo y
   la rodilla abierta (desplazamiento lateral deportivo). Altura del pie por personaje en `packs.json` → `cfg.gait.latLift`
   (S.W.A.T. y FSB 7 cm; MILITAR 3 cm por las rodilleras). Regenerado con `python tools/personaje-ext/make.py <pack> --glb`.
3. Zonas de impacto: las tres, en sus 3 LOD, pasan `tools/check-character-hitbox.js` (±4 cm; los pies, dentro de la
   excepción ya aprobada de 45 cm en el eje de la marcha). `make.py` ya **no copia** al juego si alguna comprobación falla.
LINCE (`?pj=3`) y la rev. 03 (`?pj=2`) llevan la mejora del punto 1, pero no se han regenerado con el clip lateral nuevo.
