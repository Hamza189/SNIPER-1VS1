/* Capturas del CAMUFLAJE EN VIVO (09-11-2026, docs/GUNSMITH.md): la tira del ARSENAL en el PC y en el móvil en
   horizontal, la TÁCTICA pintada y la REJILLA DE ORO antes y después (la de antes, si se pasa su foto).
   node tools/capture-camo.js CARPETA [rejilla_antes.jpg]      env GPU=0: WebGL por software */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '.', OLD = process.argv[3], GPU = process.env.GPU !== '0';
const ARGS = GPU ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ACC = () => { __SD.ACC.acc = { name: 'capturas', inv: { items: SDItems.ITEMS.filter(i => i.type === 'camo').map(i => i.id), equip: {}, boxes: 0, pts: 0, daily: false, dailyIn: 0, botsLeft: 0 } }; };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start(), b = await chromium.launch({ args: ARGS });
  const page = async (vp, mobile, old) => {
    const ctx = await b.newContext(Object.assign({ viewport: vp }, mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    if (old) await ctx.route(/assets\/camo\/oro_rejilla\.jpg/, r => r.fulfill({ path: old, contentType: 'image/jpeg' }));
    const p = await ctx.newPage(); await p.goto(srv.url, { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.M2 && __SD.M2.room && __SD.VMA.ready, null, { timeout: 180000 });
    await p.evaluate(ACC); await p.evaluate(() => document.querySelector('#m2 .m2Nav [data-tab=armas]').click());
    await p.waitForFunction(() => __SD.M2.item, null, { timeout: 60000 });
    return { p, ctx };
  };
  const model = (p, slot, id) => p.evaluate(([slot, id]) => document.querySelector((slot === 'rifle' ? '#gsRifles' : '#gsKnives') + ' [data-ws=' + id + ']').click(), [slot, id])
    .then(() => p.waitForFunction(([slot, id]) => { const S = __SD.WS_ST[slot]; return S.cur === id && (id === 'halcon' || id === 'navaja' || (S.objs.length && !S.light)) && __SD.M2.item; }, [slot, id], { timeout: 300000 }).catch(() => {}));
  const camo = (p, id) => p.evaluate(id => { if (document.getElementById('gsPick').hidden) document.getElementById('gsCamoB').click(); const o = document.querySelector('#gsPick [data-opt="' + id + '"]'); o.scrollIntoView({ inline: 'center' }); o.click(); }, id);
  const shot = async (p, n) => { await p.waitForTimeout(1500); await p.screenshot({ path: path.join(OUT, n + '.jpg'), quality: 82 }); console.log(n); };

  for (const [tag, old] of OLD ? [['antes', OLD], ['despues', null]] : [['despues', null]]) {
    const { p, ctx } = await page({ width: 1366, height: 768 }, false, old);
    await model(p, 'rifle', 'ultima'); await camo(p, 'camo_oro_rejilla');
    await p.evaluate(() => { __SD.M2.wZoom = 1.7; });
    await shot(p, 'rejilla-' + tag);
    if (tag === 'despues') {
      await p.evaluate(() => { __SD.M2.wZoom = 1; }); await model(p, 'rifle', 'titan'); await camo(p, 'camo_tigre'); await shot(p, 'camo-tira');
      await model(p, 'knife', 'tactica'); await camo(p, 'camo_dragon'); await shot(p, 'tactica-camo');
    }
    await ctx.close();
  }
  const { p, ctx } = await page({ width: 844, height: 390 }, true);
  await model(p, 'rifle', 'sahara'); await camo(p, 'camo_carbono_azul'); await shot(p, 'camo-tira-movil');
  await ctx.close();
  await b.close(); srv.close(); process.exit(0);
})();
