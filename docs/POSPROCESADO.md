# Posprocesado por calidad (`?post=1`) — 25-11-2026

Fase 2 de 5 del encargo «que se parezca más a Call of Duty / PUBG sin cambiar de motor». Lo que hace un juego de tiros
moderno después de dibujar la escena, hecho a mano en `client/post.js` (unas pocas pasadas a pantalla completa con
`ShaderMaterial` de Three.js r128; ninguna librería nueva, ningún servicio).

**Estado**: IMPLEMENTADO · PROBADO EN NAVEGADOR (SwiftShader: aspecto y llamadas) · PENDIENTE DE QUE EL PROPIETARIO LO
VEA EN SU PC Y SU IPHONE (FPS). Detrás de `?post=1` (se recuerda en el aparato; `?post=0` lo quita). Solo pasa a ser lo
de por defecto si el propietario lo aprueba.

## Qué lleva cada calidad
| | ALTO | MEDIO | BAJO |
|---|---|---|---|
| Oclusión ambiental de pantalla (SSAO) | sí (a ½ resolución en PC, ⅓ en el móvil) | no | no |
| Brillo de luces fuertes (bloom, solo lo muy brillante: umbral 0,9) | dos tamaños (¼ y ⅛) | uno (¼) | no |
| Suavizado de bordes | FXAA | MSAA 4× en el render target (WebGL 2; si no, FXAA) | el de siempre (ninguno) |
| Corrección de color (contraste, sombras frías / luces cálidas, saturación, viñeta) | sí | sí (más suave) | no |

- La corrección va **después** del tono ACES y del ESTILO DE IMAGEN que elige el jugador, que siguen igual.
- El SSAO solo oscurece la escena: el arma en primera persona se dibuja encima, sin él.
- Con `?post=1` el lienzo ya no pide su propio MSAA (lo hace el render target o el FXAA): no se paga dos veces.
- `&ssao=0`: ALTO sin SSAO (para comparar su coste).
- Cambiar la calidad en AJUSTES › GRÁFICOS cambia el nivel al momento.

## Coste (por fotograma)
- ALTO: SSAO (1 pasada a ½ res + desenfoque + multiplicar) + bloom (3 pasadas a ¼ y 3 a ⅛) + final = **10 llamadas** más.
- MEDIO: bloom (3 a ¼) + final = **4 llamadas** más, y la resolución del MSAA pasa del lienzo al render target.
- Lo que cuesta de verdad es el ancho de banda de la GPU (leer y escribir la imagen entera). En el iPhone a 2× es
  donde más se nota: por eso el SSAO va allí a ⅓ y la resolución adaptativa de siempre sigue funcionando.
- Medidas en la sección «Medidas».

## Cómo se engancha (src/page.html)
`POST.begin()` (la escena va a un render target) → `renderer.render(scene)` → `POST.afterScene(camera)` (SSAO) → el
arma → `POST.end()` (bloom, color y FXAA a la pantalla). El menú, la sala y la pantalla de carga no pasan por aquí.

## Ajustes que salieron de las capturas
- Primera versión: bloom desde 0,8 y fuerza 0,55 → las paredes encaladas brillaban y el horizonte se veía con neblina
  (aspecto de sueño, no de juego militar). Ahora umbral 0,9, fuerza 0,22 (ALTO) / 0,2 (MEDIO).
- SSAO con ruido blanco y desenfoque de 4 muestras → grano gris junto a los tabiques. Ahora 12 muestras con ruido
  ordenado y desenfoque de 3×3 que respeta los bordes: sin grano.
- Saturación 1,05 → 0,98: el naranja de la casa terracota se pasaba.

## Medidas (25-11-2026)
| | Llamadas sin / con | Triángulos |
|---|---|---|
| ALTO, fachada | 129 / 139 | iguales (+20: los cuadros de pantalla) |
| ALTO, vista general | 166 / 176 | iguales |
| MEDIO, fachada | 121 / 125 | iguales |
| MEDIO, vista general | 155 / 159 | iguales |

GPU real del PC (GTX 1050 Ti, `tools/gpu-coste.js`: PUEBLO en ALTO al tamaño del iPhone 932×430 a 2×, cada fotograma
cronometrado hasta que la GPU termina; lo mejor de 2 rondas):

| Variante | ms por fotograma | frente a la base |
|---|---|---|
| base | 2,1 | — |
| `?lm=1` (fase 1) | 2,2 | +0,1 |
| `?post=1` | 2,3 | +0,2 |
| `?post=1&ssao=0` | 2,2 | +0,1 |
| `?post=1&lm=1` | 2,4 | +0,3 |

Con la ventana de juego normal: 60 FPS en todos los casos (el tope de la pantalla). Una GPU de PC no es la del iPhone:
esto dice el orden de los costes, no los milisegundos del iPhone. En el iPhone: PENDIENTE (lo mide el propietario con
MEDIR RENDIMIENTO).

Capturas: `docs/img/posprocesado/` (sin arriba, con abajo).
