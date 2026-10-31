/* Ajustes ampliados (30-10-2026, «los ajustes de los grandes shooters de móvil»): lógica pura de client/settings.js.
   - sensibilidad por situación: sin mira en 1ª y 3ª persona, y cada zoom del visor (4× y 8×)
   - giroscopio: apagado por defecto; «al apuntar» solo con la mira; 1:1 sin mira y dividido por el zoom con ella
   - cruceta, visor, marcador e impactos: solo colores y estilos de la lista; brillo y estilo de imagen con sus límites
   - nada de esto cambia lo que ya había: con los valores por defecto el giro es el mismo que antes
   Run: node test/ajustes.test.js */
'use strict';
const S = require('../client/settings.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const near = (a, b) => Math.abs(a - b) < 1e-9;

console.log('\nVALORES POR DEFECTO: TODO COMO ANTES');
const d = S.defaults(false), dt = S.defaults(true);
check('giroscopio apagado, cruceta de siempre (cruz con punto, color del HUD), visor rojo, sangre roja', d.gyro === 'off' && d.xStyle === 'crossdot' && d.xColor === '#f4ead8' && d.retColor === '#ff3b2f' && d.blood === 'red' && d.look === 'clasico' && d.cvd === 'off' && d.bright === 1);
const base = { fovRatio: 1, touch: false };
// the old formula, written out: what the game turned before these settings
const old = (dx, dy, s, c) => { const k = (c.touch ? 0.0042 : 0.0022) * c.fovRatio * (c.scoped ? s.adsSens : 1) * (c.touch ? s.touchLook : 1);
  const a = Math.max(0, Math.min(1, c.ads || 0)); return { yaw: -dx * k * s.sensH * (1 + (s.adsH - 1) * a), pitch: -dy * k * s.sensV * (1 + (s.adsV - 1) * a) }; };
let same = true;
for (const c of [{ ...base }, { ...base, tp: true }, { ...base, scoped: true, ads: 1, zoom: 4, fovRatio: 0.2 }, { ...base, scoped: true, ads: 1, zoom: 8, fovRatio: 0.1 }, { fovRatio: 1, touch: true, ads: 0.5 }]) {
  for (const s of [d, dt, Object.assign({}, d, { adsSens: 1.4, adsH: 0.7, sensH: 2 })]) {
    const n = S.lookDelta(30, -12, s, c), o = old(30, -12, s, c);
    if (!near(n.yaw, o.yaw) || !near(n.pitch, o.pitch)) same = false;
  }
}
check('con los valores por defecto, el mismo giro que antes (PC, móvil, 3ª persona, visor 4× y 8×)', same);

console.log('\nSENSIBILIDAD POR SITUACIÓN');
const s1 = S.sanitize({ sensFP: 1.5, sensTP: 0.5, scope4: 2, scope8: 0.5 }, false);
const fp = S.lookDelta(10, 0, s1, { ...base }), tp = S.lookDelta(10, 0, s1, { ...base, tp: true }), ref = S.lookDelta(10, 0, d, { ...base });
check('sin mira: 1ª persona ×1,5 y 3ª persona ×0,5', near(fp.yaw, ref.yaw * 1.5) && near(tp.yaw, ref.yaw * 0.5));
const ads = S.lookDelta(10, 0, s1, { ...base, tp: true, ads: 1 }), adsRef = S.lookDelta(10, 0, d, { ...base, ads: 1 });
check('con la mira puesta deja de contar la de 1ª/3ª persona', near(ads.yaw, adsRef.yaw));
const z4 = S.lookDelta(10, 0, s1, { ...base, scoped: true, ads: 1, zoom: 4 }), z8 = S.lookDelta(10, 0, s1, { ...base, scoped: true, ads: 1, zoom: 8 }),
  z4r = S.lookDelta(10, 0, d, { ...base, scoped: true, ads: 1, zoom: 4 });
check('visor: 4× y 8× cada uno con su multiplicador', near(z4.yaw, z4r.yaw * 2) && near(z8.yaw, z4r.yaw * 0.5));
check('fuera de los límites se recorta (0,3–3 y 0,3–2)', S.sanitize({ sensFP: 9, scope8: 0 }, false).sensFP === 3 && S.sanitize({ scope8: 0 }, false).scope8 === 0.3);

console.log('\nGIROSCOPIO');
check('apagado: no gira nada', S.gyroDelta(20, 10, d, { ...base }).yaw === 0);
const gOn = S.sanitize({ gyro: 'on' }, true), gAds = S.sanitize({ gyro: 'ads', gyroAds: 2 }, true);
check('SIEMPRE: 1:1 sin mira (10° del móvil = 10° de cámara)', near(S.gyroDelta(10, -5, gOn, { ...base }).yaw, 10 * Math.PI / 180) && near(S.gyroDelta(10, -5, gOn, { ...base }).pitch, -5 * Math.PI / 180));
check('AL APUNTAR: nada sin mira, y con la mira su propia sensibilidad', S.gyroDelta(10, 0, gAds, { ...base, ads: 0.2 }).yaw === 0 && near(S.gyroDelta(10, 0, gAds, { ...base, ads: 1 }).yaw, 20 * Math.PI / 180));
const gz = S.gyroDelta(10, 0, gOn, { fovRatio: 0.1, scoped: true, ads: 1, zoom: 8 });
check('con el visor se divide por el zoom, como el dedo', near(gz.yaw, 10 * Math.PI / 180 * 0.1 * gOn.adsSens * gOn.scope8));
check('invertir: los dos ejes al revés', near(S.gyroDelta(10, 4, S.sanitize({ gyro: 'on', gyroInv: true }, true), { ...base }).yaw, -10 * Math.PI / 180));
check('un modo desconocido vuelve a apagado', S.sanitize({ gyro: 'turbo' }, true).gyro === 'off');

console.log('\nMIRA, VISOR, IMPACTOS, IMAGEN');
check('colores solo de la lista', S.sanitize({ xColor: '#123456', retColor: '#4dff6a', hitColor: 'red' }, false).xColor === '#f4ead8' && S.sanitize({ retColor: '#4dff6a' }, false).retColor === '#4dff6a' && S.sanitize({ hitColor: 'red' }, false).hitColor === '#ffffff');
check('estilos de cruceta, sangre, imagen y daltonismo solo de la lista', S.sanitize({ xStyle: 'circle', blood: 'green', look: 'cine', cvd: 'deut' }, false).xStyle === 'circle' && S.sanitize({ xStyle: 'x', blood: 'azul', look: 'neon', cvd: 'x' }, false).look === 'clasico');
check('tamaños de cruceta y brillo con sus límites', (() => { const o = S.sanitize({ xLen: 99, xThick: 0, xGap: -5, bright: 3 }, false); return o.xLen === 24 && o.xThick === 1 && o.xGap === 0 && o.bright === 1.4; })());
check('MIRA Y EFECTOS tiene su RESTAURAR (y no toca la sensibilidad)', (() => { const o = S.resetCategory(S.sanitize({ xStyle: 'dot', sensFP: 2 }, false), 'mira', false); return o.xStyle === 'crossdot' && o.sensFP === 2; })());
check('modo MIXTO del botón MIRA aceptado', S.sanitize({ adsMode: 'mixed' }, true).adsMode === 'mixed');
check('suavizado de bordes: encendido por defecto (PC y móvil), se puede apagar y GRÁFICOS lo restaura',
  S.defaults(false).aa === true && S.defaults(true).aa === true && S.sanitize({ aa: false }, true).aa === false && S.sanitize({ aa: 'no' }, true).aa === true &&
  S.resetCategory(S.sanitize({ aa: false }, true), 'graficos', true).aa === true);

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
