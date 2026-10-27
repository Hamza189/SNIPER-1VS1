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
