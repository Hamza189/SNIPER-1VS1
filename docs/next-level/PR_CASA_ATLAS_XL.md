Título:
CASA ATLAS XL (40×32 m), todos los mapas en el menú y dos fallos corregidos (online y bots de CASA)

Descripción:
## Qué cambia
- **CASA ATLAS XL** (entrega de ChatGPT, 40 × 32 m: villa, garaje, patio con estanque, pérgola, jardín, calle y
  callejones) como mapa experimental **solo contra bots**. El servidor no lo recibe todavía (`WORLDS.casaxl.local`,
  `tools/export-map.js` lo salta): `core/mapdata.js` no cambia.
- La sección **Mapa** del duelo ofrece siempre ARENA, PUEBLO, CASA ATLAS y CASA ATLAS XL (`?casa=0` oculta los
  experimentales). En online: ARENA, PUEBLO y CASA ATLAS.
- **Fallo online corregido:** tras reiniciarse el servidor de una sala (cada despliegue), el cliente descartaba los
  eventos de la partida siguiente (inicio, impactos, bajas, reapariciones, final). Solo cliente (`client/netcore.js`).
- **Bots de CASA ATLAS corregidos:** ya no aparecen encerrados en un hueco de la cocina (27/300 → 0/300) ni andan a
  tirones (9,4 % → 0,19 % de ticks parados).
- Documentación: incorporación a Claude Code, auditoría con cuatro agentes, informe de evolución tecnológica, encargo
  a ChatGPT y NEXT LEVEL (playtest y registro de cambios).

## Medidas
- CASA ATLAS → XL: visión media 6,1 → 14,9 m; máxima 18,6 → ~38–41 m; 13 % de líneas de tiro > 25 m; salidas a 42,4 m
  sin verse. 23 llamadas de dibujo y ~35 000 triángulos (GTX 1050 Ti).
- `npm test`: 955 correctas, 0 fallidas (26 suites; nuevas: reinicio de sala, red de bots de CASA, `casaxl.browser`).

## A tener en cuenta al fusionar
- `client/netcore.js` está en la lista de rutas de «Desplegar servidor»: al fusionar en `main` **se redesplegará el
  servidor** (mismo código de servidor y mismo `core/`, pero se reinician las salas abiertas). Mejor fusionar sin
  partidas en curso.
- XL tiene acabado sencillo (texturas procedurales) y ~55 MB de texturas en GPU: pendiente optimizarlas y probar en
  iPhone/Samsung. El 1v1 online en XL necesitará desplegar su mapa en el servidor (con aprobación).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
