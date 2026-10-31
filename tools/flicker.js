/* PARPADEO: how much the picture "shimmers" when the camera barely moves (what the owner saw on the iPhone, 31-10-2026:
   distant façades that flicker instead of looking smooth). The camera stays at a fixed spot and turns by a fraction of a
   pixel each frame (like the idle sway of the character); every drawn frame is compared with the previous one. A smooth
   picture hardly changes (a sub-pixel turn only moves edges a little); an aliased one (edges without antialiasing, thin
   railings, coplanar faces that fight for the depth buffer) changes a lot.
   node tools/flicker.js OUT_DIR [prefix]
   env: VARIANTS='base:aa=0;msaa:aa=1;near:aa=0&near=0.15' (name:extra URL; a variant can also say dpr=3) · W=932 H=430
   DPR=2 (iPhone 15 Pro Max in landscape at the game's 2× resolution) · N=16 frames · STEP=0.25 (px of turn per frame) ·
   Q=alto · ONLY=views
   The camera pans slowly and evenly (STEP px per frame). Two numbers per view, both per pixel (0–255) over the upper
   70 % of the picture (the buildings, not the ground at the feet):
   - cambio: mean |frame − previous frame|. Any edge that moves changes a little, smooth or not.
   - parpadeo: mean |next − 2·frame + previous|. A smooth (antialiased) edge brightens step by step while it crosses a
     pixel, so this stays near 0; an aliased one jumps from one colour to the other in a single frame and back: high.
   Output: one picture per view and variant (the first frame on top, the flicker map below: white = flickers) and
   flicker.json.
   Software WebGL (SwiftShader): good for comparing how the picture looks, not for measuring FPS. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '.', PRE = process.argv[3] || 'parpadeo';
const VW = +(process.env.W || 932), VH = +(process.env.H || 430), DPR = +(process.env.DPR || 2), N = +(process.env.N || 16), STEP = +(process.env.STEP || 0.25);
const Q = process.env.Q || 'alto';
const VARIANTS = (process.env.VARIANTS || 'base:aa=0;msaa:aa=1').split(';').map(v => { const i = v.indexOf(':'); return [v.slice(0, i), v.slice(i + 1)]; });
// [name, x, y (feet), z, yaw, pitch, zoom]  — yaw 0 looks towards -z; zoom > 1 = through the scope (fov / zoom)
const VIEWS = [
  ['plaza-este', -30, 0, 0, -Math.PI / 2, 0.05, 1],      // across the plaza to the east row of houses (40–80 m)
  ['calle-norte', 0.5, 0, 38, 0, 0.02, 1],               // down the north street to the plaza and the far façades
  ['este-visor8', -30, 0, 0, -Math.PI / 2 + 0.05, 0.03, 8], // the east façades ~70 m away through the 8× scope
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const res = {};
  for (let [vname, extra] of VARIANTS) {
    const dpr = +((extra.match(/(?:^|&)dpr=([0-9.]+)/) || [])[1] || DPR); extra = extra.replace(/(?:^|&)dpr=[0-9.]+/, '');
    const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: dpr });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 2 })); localStorage.setItem('sniperduel_p3', 'true'); } catch (e) {} }, Q);
    const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
    await p.goto(srv.url + '?vm=1&pueblo=3' + (extra ? '&' + extra : ''));
    await p.waitForTimeout(2500);
    await p.evaluate(() => { __SD.setTrain('off'); __SD.setMode('duel'); __SD.startMatch(); });
    await p.waitForFunction(() => __SD.P3W && __SD.P3W.kit && (!__SD.E10.on || __SD.E10.ready || __SD.E10.failed), null, { timeout: 120000 });
    await p.waitForTimeout(1500);
    const aa = await p.evaluate(() => { const gl = __SD.renderer.getContext(); return { samples: gl.getParameter(gl.SAMPLES), near: __SD.camera.near, pr: __SD.renderer.getPixelRatio() }; });
    console.log(vname, extra, JSON.stringify(aa));
    res[vname] = { url: extra, gl: aa, views: {} };
    for (const [name, x, y, z, yaw, pitch, zoom] of VIEWS) {
      if (ONLY && !ONLY.includes(name)) continue;
      const r = await p.evaluate(async ([x, y, z, yaw, pitch, zoom, N, STEP]) => {
        const S = __SD; S.setWorld('pueblo'); S.freeze(true); S.SHOT.noVM = true; S.MANUAL.on = true;
        document.getElementById('hud').hidden = true;
        for (const b of S.RANGE_BOTS.concat(S.BOTS)) { b.g.visible = false; if (b.glint) b.glint.visible = false; }
        Object.assign(S.PM, { x, y, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y, z });
        S.WS.zoom = S.WS.zoomCur = zoom > 1 ? zoom : 8; S.WCORE.ads = zoom > 1 ? 1 : 0;
        const cv = S.renderer.domElement, W = cv.width, H = cv.height, H7 = Math.round(H * 0.7);
        // one turn step = STEP px at the centre of the picture, whatever the zoom
        const fov = S.camera.fov * Math.PI / 180 / (zoom > 1 ? zoom : 1), step = STEP / ((H / 2) / Math.tan(fov / 2));
        const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const g = c2.getContext('2d', { willReadFrequently: true });
        const fr = [], A1 = new Float32Array(W * H7), A2 = new Float32Array(W * H7); let n1 = 0, n2 = 0, first = null;
        for (let i = -3; i < N; i++) {
          S.P.yaw = yaw + step * Math.max(0, i); S.P.pitch = pitch;
          S.advance(16);
          g.drawImage(cv, 0, 0); const im = g.getImageData(0, 0, W, H7); if (i < 0) continue;
          if (!first) first = im;
          const L = new Float32Array(W * H7); for (let k = 0, j = 0; k < L.length; k++, j += 4) L[k] = (im.data[j] + im.data[j + 1] + im.data[j + 2]) / 3;
          fr.push(L); if (fr.length > 3) fr.shift();
          if (fr.length >= 2) { const a = fr[fr.length - 2], b = fr[fr.length - 1]; for (let k = 0; k < L.length; k++) A1[k] += Math.abs(b[k] - a[k]); n1++; }
          if (fr.length === 3) { const [a, b, c] = fr; for (let k = 0; k < L.length; k++) A2[k] += Math.abs(c[k] - 2 * b[k] + a[k]); n2++; }
          await new Promise(r => setTimeout(r, 0));
        }
        let s1 = 0, s2 = 0; const hist = new Uint32Array(256);
        for (let k = 0; k < A1.length; k++) { s1 += A1[k] / n1; const v = A2[k] / n2; s2 += v; hist[Math.min(255, v | 0)]++; }
        const pct = q => { let n = 0, t = A2.length * q; for (let v = 0; v < 256; v++) { n += hist[v]; if (n >= t) return v; } return 255; };
        const hm = g.createImageData(W, H7); for (let k = 0, j = 0; k < A2.length; k++, j += 4) { const v = Math.min(255, A2[k] / n2 * 4); hm.data[j] = hm.data[j + 1] = hm.data[j + 2] = v; hm.data[j + 3] = 255; }
        const out = document.createElement('canvas'); out.width = W; out.height = H7 * 2; const o = out.getContext('2d');
        o.putImageData(first, 0, 0); o.putImageData(hm, 0, H7);
        S.WCORE.ads = 0;
        return { cambio: +(s1 / A1.length).toFixed(3), parpadeo: +(s2 / A2.length).toFixed(3), p99: pct(0.99), p999: pct(0.999), frames: N, png: out.toDataURL('image/png') };
      }, [x, y, z, yaw, pitch, zoom, N, STEP]);
      fs.writeFileSync(path.join(OUT, PRE + '-' + name + '-' + vname + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
      delete r.png; res[vname].views[name] = r;
      console.log('  ', name, JSON.stringify(r));
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, PRE + '.json'), JSON.stringify(res, null, 1));
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
