# SNIPER DUEL — CASA ATLAS 1V1 · ENTREGA 3D REAL

**Tipo:** mapa de apartamento moderno compacto, interior 1 planta, 18 × 14 m, diseñado para 1v1.

**No es una imagen de referencia:** `models/sd_casa_atlas_1v1.glb` contiene la geometría real de suelo, paredes segmentadas, puertas transitables, ventanas, salón, estudio, cocina, baño, dormitorio, comedor, mobiliario y balcón. El techo está en `models/sd_casa_atlas_roof_optional.glb` para controlar iluminación y evitar tapar el mapa en las vistas de prueba.

## Archivos obligatorios

- `models/sd_casa_atlas_1v1.glb` — GLB glTF 2.0 con PBR y UV, +Y arriba, 1 unidad = 1 metro. Origen central.
- `models/sd_casa_atlas_roof_optional.glb` — techo independiente. En producción interior, usar techo con iluminación adecuada; en la vista de editor, ocultarlo.
- `collision_map.json` — **fuente geométrica de los 78 volúmenes de colisión**, incluidas paredes y muebles sólidos y barandilla que limita movimiento. Las colisiones no están ocultas dentro del GLB para que cliente y servidor puedan compartir datos.
- `web/apartmentMap.js` — cargador y adaptador para Three.js r128 (requiere inyección de THREE, GLTFLoader y escena), más prueba de movimiento referencial.
- `web/index.html` — visor 3D de prueba: giro orbital, cenital, FPS con WASD, techo y depuración de colisiones.
- `src/make_apartment.py` — código fuente para regenerar el GLB desde cero. Dependencias `pip install -r requirements.txt`.
- `src/qa_map.py` — validación local de geometría, UV, normales y conectividad entre spawns.
- `preview/` — cuatro capturas renderizadas del GLB, más plano de colisiones.
- `assets/` — material PBR `beige_wall_001` CC0 reproducible en el generador.

## Ejes y escala

- Centro geométrico: (0,0,0); interior entre X=-8.7..8.7, Z=-6.7..5.3; balcón en Z=5.3..7.
- Piso jugable en Y=0; paredes ~3.12 m. +Y arriba.
- Principalmente combate a corta y media distancia; **no sustituir Pueblo**.
- Spawns A `(-7.45, 0, 0.57)`, B `(7.15, 0, 0.20)`.
- Zonas: salón, dormitorio, baño, cocina, estudio, comedor y balcón.

## Integración segura en Sniper Duel

1. **Añadir un mapa nuevo `CASA_ATLAS_1V1`**, independiente de PUEBLO/ARENA. Mantener mapas antiguos y todas sus reglas.
2. Copiar los archivos bajo `assets/maps/casa_atlas/` o adaptar rutas. En navegador usar `loadCasaAtlas({ THREE, GLTFLoader, scene, assetBase: '/SNIPER-1VS1/assets/maps/casa_atlas/' })`, ajustando el prefijo a la instalación.
3. **MUY IMPORTANTE:** inspeccionar `core/mapdata.js` y la validación autoritativa de Cloudflare. Añadir las mismas colisiones estáticas a servidor y cliente, transformando AABB en el esquema existente. Sin sincronización exacta no habilitar online. No usar solo los meshes GLB para detectar disparos.
4. Tipos de colisiones: `solid` = movimiento + balas; `player_boundary` = barreras para el movimiento en el balcón que no deben crear bala bloqueada ficticia. Verificar ventanas: hay vidrio visual no solid; decidir explícitamente si las balas atraviesan cristal, si se rompe o si rebota; aplicar misma regla en server/client.
5. Mantener movimiento, ADS, armas, HUD, bots, daño y multijugador existentes. Mapear spawns A/B solo tras comprobar la altura de jugador y su cápsula.
6. La escena tiene superficies PBR embebidas. **No multiplicar el color base sin necesidad**; configurar color management de THREE r128, iluminación ambiental suficiente para interiores. El techo es independiente: medir rendimiento y visibilidad cuando esté activo.
7. Probar mapa SOLO en un selector experimental. Capturar al nivel de los ojos y desde el visor; revisar paso por puertas, clipping de muebles, balas en ventanas, framerate y partidas 1v1 reales.
8. Auditar texturas y materiales en móvil. Reducir si fuera necesario, sin modificar la escala de colisiones.
9. Ejecutar las pruebas actuales de Sniper Duel; añadir pruebas de spawn conectados, puertas accesibles, colisiones servidor/cliente idénticas y regresión online.

### Ejemplo mínimo de importación

```js
import { loadCasaAtlas } from './web/apartmentMap.js';
const map = await loadCasaAtlas({
  THREE,
  GLTFLoader,
  scene: gameScene,
  assetBase: '/SNIPER-1VS1/assets/maps/casa_atlas/',
  debugCollisions: false
});
// Integrar map.playerColliders/map.bulletColliders con tu motor, no asumir un API nuevo.
// Para liberar al cambiar de mapa:
// map.dispose();
```

## Vista previa local (sin tocar tu GitHub)

1. Abre una terminal en esta carpeta del ZIP.
2. Ejecuta `py -m http.server 8080` (en Windows) o `python -m http.server 8080`.
3. Abre `http://localhost:8080/web/` en un navegador con WebGL.
4. El visor utiliza scripts de Three.js r128 desde jsDelivr: necesita conexión a internet para esa biblioteca. Las mallas, JSON y texturas del mapa se sirven localmente.
5. Pulsa **Caminar FPS**, haz clic en el render y utiliza WASD. La simulación del visor es solo demostración local; el movimiento del juego debe usar tu motor propio.

## Calidad / limitaciones honestas

- Modelo de producción **experimental**, no mapa AAA terminado ni integrado en Cloudflare.
- Geometría y texturas reales (no una imagen generada). Las piezas de mobiliario están modeladas de forma modular, algunas siluetas son estilizadas. El estuco usa un material PBR CC0 de Poly Haven; otras superficies usan texturas generadas, no escaneos fotográficos.
- No hay scripts maliciosos, assets de armas ni lógica de red dentro del GLB.
- No existe prueba de FPS real en iPhone ni Samsung. Claude debe comparar con otras escenas y optimizar según mediciones.
- Las luces decorativas están modeladas pero no generan iluminación física por sí mismas; asignar luces Three.js es trabajo de integración.
- El techo opcional necesita luces interiores para el juego real. En las capturas aéreas está oculto.

## Validación local efectuada por ChatGPT

- Exportación GLB y reimportación glTF correctas.
- 32 lotes de mallas; 10.108 triángulos en el edificio sin techo; 78 colisiones (paredes/muebles/balcón).
- UV y normales de las mallas comprobadas; no hay geometría fuera de 18 × 14 m (salvo gruesos estructurales de centímetros).
- Spawns alcanzables entre sí mediante recorrido por suelo con un radio de jugador de 0.29 m.
- **Pendiente:** ejecución del validador particular de tu repositorio, integración, rutas reales, online y pruebas de móvil.

### Qué quiero que me comuniques, Claude

En primer lugar, valídalo e intégralo como mapa separado en modo experimental, sin publicar en el selector normal hasta poder jugar contra bots y 1v1. Si detectas un problema de diseño, da fichero, coordenadas y recomendación. Si los materiales no parecen creíbles en juego, muéstralo con capturas antes de rehacer el mapa entero.
