# Armas externas como aspectos (28-10-2026)

Petición del propietario: «hay una carpeta en Descargas/SNIPER DUEL ASSETSS y quiero que añadas todo».

## Qué había y qué se ha podido usar
| Archivo | Licencia | ¿Entra? | En el juego |
|---|---|---|---|
| CheyTac M200 «Intervention» — Aleksandr (sannf4) | CC BY 4.0 | Sí | Rifle **TITÁN** |
| PGM Ultima Ratio — drepi.3d | CC BY 4.0 | Sí | Rifle **ÚLTIMA** |
| Modern Sniper Rifle (Free Lowpoly) — Vlasov Daniil | CC BY 4.0 | Sí | Rifle **VECTOR** |
| Sniper Rifle — awakov_dawid | CC BY 4.0 | Sí (ver aviso) | Rifle **SAHARA** |
| Tactical Knife — lunea | CC BY 4.0 | Sí | Cuchillo **TÁCTICA** |
| Modern Tactical Soldier — ItsKrish7 | CC BY 4.0 | Aún no | Viene sin esqueleto (modelo generado con IA, 378 000 triángulos, mochila grande): hay que riggearlo antes |
| Beretta APX A1 ×2, PX4, PMX, BRX1 — geyges; Remington XM2010 — ardickasaretas | Sketchfab **Standard** | **No** | La licencia prohíbe publicarlos de forma que se puedan descargar o extraer (§2.2 b) y exige protegerlos (§12). En un juego web el `.glb` se descarga tal cual y el repositorio es público: mismo caso que el de TurboSquid |

**Nombres de marca:** en el juego llevan nombres inventados (TITÁN, ÚLTIMA, VECTOR, SAHARA, TÁCTICA). Los créditos citan los
títulos originales, como pide CC BY. **Aviso:** la textura del SAHARA lleva el logotipo «CADEX DEFENCE» (marca real): taparlo
antes de una versión de pago. Las demás no muestran logotipos legibles en primera persona.

## Cómo entran
Solo aspecto (cosmético): balas, daño, cadencia, retroceso y zonas de impacto son las del HALCÓN R7 y la NAVAJA. Se eligen en la
ventana de **Tu personaje** (con `?pj=pro` o `?pj=mix`): «Tu rifle» y «Tu cuchillo». Se guardan en el dispositivo
(`sniperduel_wsRifle`, `sniperduel_wsKnife`). Por ahora se ven en tu 1ª persona; los demás y la 3ª persona siguen viendo el
HALCÓN (siguiente paso: enviarlo al rival como el personaje).

- El modelo del HALCÓN se oculta y el del aspecto ocupa su sitio, alineado por el **gatillo** (el dedo cae en él).
- **Cerrojo y cargador** del aspecto cuelgan de los del HALCÓN: se mueven con sus animaciones, y sus nodos se colocan donde
  están esas piezas en el arma nueva, así la mano derecha va a la palanca de cada rifle y la izquierda a su cargador.
  VECTOR no tiene palanca aparte (la mano va a su sitio igual); SAHARA tiene el cargador enrasado (no se separa).
- El fogonazo sale de la boca de cada rifle.

## Conversor `tools/arma-ext`
```
python tools/arma-ext/make.py <id> --medir    vista de lado y desde arriba con regla en cm (.work/<id>/medir/regla*.png)
python tools/arma-ext/make.py <id>            assets/armas/<id>/arma.glb (1ª persona), arma_tp.glb (3ª), info.json, CREDITOS.md
node tools/arma-retratos.js                   retratos de la ventana de selección
```
La ficha de cada arma (`tools/arma-ext/armas.json`) lleva la licencia (solo CC BY / CC0: el conversor se niega con otras) y
las medidas leídas con la regla: largo real, qué es arriba, enderezado (SAHARA venía inclinado 4°, el cuchillo en diagonal),
altura del ánima, gatillo, cajas del cerrojo y del cargador, y cajas para quitar sobrantes (cartuchos sueltos y el bípode
desplegado del TITÁN).

| Arma | Triángulos 1ª / 3ª | Texturas | Peso |
|---|---|---|---|
| TITÁN | 24 600 / 2 500 | 2048 | 6,3 MB |
| ÚLTIMA | 22 800 / 2 500 | 2048 | 5,5 MB |
| VECTOR | 19 500 / 2 500 | 2048 | 3,5 MB |
| SAHARA | 22 200 / 2 500 | 2048 | 5,5 MB |
| TÁCTICA | 1 800 / 600 | 1024 | 0,6 MB |
Solo se descarga el aspecto elegido, cuando lo eliges (el HALCÓN tiene 18 000 triángulos).

Pruebas: `node test/armas.browser.test.js` (los 4 rifles disparan y accionan el cerrojo con su modelo; volver al HALCÓN lo deja
como siempre; cuchillo; se guarda; sin 404).
