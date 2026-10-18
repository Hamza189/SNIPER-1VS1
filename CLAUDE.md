# CLAUDE.md — instrucciones permanentes para trabajar en SNIPER DUEL

Léelo entero antes de tocar nada. Después lee `docs/claude-code/SNIPER_DUEL_HANDOFF.md` (punto de entrada) y, según la
tarea, los demás documentos de `docs/claude-code/`.

## Qué es esto en una línea
Shooter PvP de francotiradores en el navegador (Three.js r128), con 1v1 online autoritativo en Cloudflare Workers +
Durable Objects, modo offline contra bots y controles táctiles para iPhone/Android. Publicado en
https://hamza189.github.io/SNIPER-1VS1/ desde la rama `main`.

## El propietario
- Hamza. Escribe en español: responde en español, claro y sin jerga innecesaria.
- Prueba en iPhone 15 Pro Max y en un portátil MSI (GPU NVIDIA GTX 1050 Ti Max-Q); su novia prueba en un Samsung.
- Nunca le digas «descansa» ni le mandes a dormir.
- Reparto: ChatGPT fabrica assets 3D y dirección de arte; Claude integra, valida, mide, optimiza y publica (solo Claude
  toca el código); el propietario prueba y aprueba.

## Reglas (literales o casi literales del propietario; siguen en vigor)
1. No rehacer el juego desde cero. Leer el código existente antes de cambiarlo. No romper funciones que ya funcionan.
2. No publicar un cambio que rompa el multijugador. Mantener la autoridad del servidor.
3. No cambiar la balística ni las hitboxes autoritativas sin comprobar el efecto en el servidor.
4. No aimbot ni ayuda de puntería oculta. Cualquier ayuda móvil debe ser opcional y explicada antes.
5. No omitir autorizaciones obligatorias. No generar gastos, no activar servicios de pago ni suscripciones, no contratar
   servicios, no añadir dependencias de pago ni servicios externos sin consultarle.
6. Nunca poner tokens administrativos en el JavaScript público. No exponer credenciales.
7. No borrar versiones estables. No sustituir el juego estable hasta que él apruebe visualmente el resultado.
8. No publicar cambios visuales que no hayan superado las comparativas con los modelos existentes. No sustituir assets que
   se vean mejor que los nuevos. Lo nuevo entra como opción (bandera de URL) y solo pasa a ser lo de por defecto si mejora.
9. No desactivar pruebas, controles de seguridad ni validaciones para conseguir un resultado verde.
10. No declarar solucionado un fallo sin verificarlo. No afirmar que el servidor está desplegado sin comprobar su URL
    pública. No declarar que el rendimiento es bueno en iPhone por pruebas de escritorio.
11. No introducir compras, APIs de pago ni assets de licencia dudosa sin autorización (Poly Haven CC0 y modelos propios
    hechos con Blender por código, sí).
12. Pedir aprobación antes de cambios importantes de equilibrio (daño, cadencia, munición) o de arquitectura.
13. Sin límite de almacenamiento para assets; la regla es que vaya fluido en su iPhone y que no baje mucho el FPS.

## Forma de trabajar
- Por fases y en commits pequeños, cada uno estable, con mensaje en español y con estas líneas al final:
  `Co-Authored-By: Claude <noreply@anthropic.com>` (y la línea de sesión si el entorno la da).
- Etiqueta siempre el estado real: IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE · PENDIENTE DE VALIDACIÓN EN IPHONE.
  No confundas «anunciado» con «comprobado».
- Medir en vez de suponer: llamadas de dibujo, triángulos, ms por fotograma, capturas antes/después con las mismas cámaras
  (`tools/capture-scenes.js`). El WebGL por software (SwiftShader) del entorno de pruebas sirve para comparar aspecto y
  contar llamadas/triángulos, **no** para FPS ni para fallos de precisión de GPU.
- Documenta cada cambio en `docs/` (assets en `docs/ASSETS-3D.md`) y actualiza `docs/claude-code/` si cambia el estado.

## Comandos
```
python3 build.py                 # core/ + client/ + src/page.html → index.html + version.json (NUNCA editar index.html)
npm test                         # build + todas las pruebas (≈ 25 suites; las de navegador tardan bastante)
node test/<nombre>.test.js       # una suite
node tools/export-map.js         # tras cambiar cualquier mapa: regenera core/mapdata.js (lo que usa el servidor)
node server/node.js              # servidor local (pruebas)
```
Requisitos: Python 3, Node 18+ (CI usa 22), `ws`, `playwright` 1.56 con Chromium; Blender como módulo `bpy` solo para
regenerar modelos. Dependencias de Python de herramientas: numpy, Pillow.

## Puntos delicados del código
- `core/` es lógica pura compartida por cliente y servidor (movimiento, armas, balística, sala). Cualquier cambio aquí
  despliega el servidor (flujo «Desplegar servidor») y debe pasar `core`, `pistol`, `shotgun` y `room` tests.
- Los mapas se construyen en `src/page.html` (`WORLDS.pueblo`, `WORLDS.arena`, `WORLDS.casa`); el servidor recibe sus
  triángulos de bala y cajas de movimiento por `tools/export-map.js` → `core/mapdata.js`. `test/browser.test.js` falla si
  no coinciden.
- Lo que se ve (GLB, kit, texturas) nunca define colisiones ni balas: eso son siempre cajas/triángulos exportados.
- Banderas de URL para todo lo experimental (lista en `docs/claude-code/SNIPER_DUEL_TECHNICAL_ARCHITECTURE.md`).
