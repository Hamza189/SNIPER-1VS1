/* SNIPER DUEL — performance probe (AJUSTES › GRÁFICOS › MEDIR RENDIMIENTO, or ?medir=1).
   Pure: no DOM. The page records real frames on the device (frame interval, CPU time of the frame, draw calls,
   triangles) while a fixed camera turns in each map, and this module turns them into numbers and a plain-text
   report the owner can copy from the phone and paste in the chat. Nothing here changes how the game plays. */
(function (root) {
'use strict';
const r1 = v => Math.round(v * 10) / 10;
function pct(sorted, p) { if (!sorted.length) return 0; const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p / 100 * (sorted.length - 1)))); return sorted[i]; }
/* frame intervals or CPU times in ms → summary. target: ms of one frame at the display/cap rate (16.7 at 60 Hz) */
function stats(list, target) {
  const a = list.filter(v => isFinite(v) && v > 0), s = a.slice().sort((x, y) => x - y), n = a.length;
  if (!n) return { n: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0, fps: 0, jank: 0, over33: 0 };
  const sum = a.reduce((x, y) => x + y, 0), t = target || 1000 / 60;
  return { n, avg: r1(sum / n), p50: r1(pct(s, 50)), p95: r1(pct(s, 95)), p99: r1(pct(s, 99)), max: r1(s[n - 1]), fps: r1(1000 * n / sum),
    jank: r1(100 * a.filter(v => v > t * 1.5).length / n),          // % of frames that took more than 1.5 display frames
    over33: r1(100 * a.filter(v => v > 33.4).length / n) };          // % below 30 FPS
}
function avgMax(list) { const a = list.filter(isFinite); if (!a.length) return { avg: 0, max: 0 }; return { avg: Math.round(a.reduce((x, y) => x + y, 0) / a.length), max: Math.max(...a) }; }
/* textures → estimated GPU memory (RGBA8 + mipmaps ×4/3; what WebGL keeps for an uncompressed texture) */
function textureMB(list) {
  // t.bytes: a texture compressed for the GPU (KTX2) gives its real size; the rest take 4 bytes per pixel
  let b = 0; for (const t of list) { const w = t.w | 0, h = t.h | 0; if (t.bytes > 0) b += t.bytes; else if (w > 0 && h > 0) b += w * h * 4 * (t.mip === false ? 1 : 4 / 3); }
  return r1(b / 1048576);
}
// where the time goes: if the frame takes much longer than its JavaScript, the wait is the GPU (or the display)
function bound(frame, cpu, target) {
  if (!frame.n) return '—';
  if (frame.p50 <= target * 1.08) return 'va a la frecuencia de la pantalla';
  return cpu.p50 > frame.p50 * 0.6 ? 'limitado por la CPU (JavaScript)' : 'limitado por la GPU (dibujo)';
}
function fmtMs(ms) { return ms >= 1000 ? (ms / 1000).toFixed(1).replace('.', ',') + ' s' : Math.round(ms) + ' ms'; }
/* report = { when, build, device: {...}, settings: {...}, load: {...}, maps: [{ id, name, loadMs, frame, cpu, calls, tris, texMB, textures, geometries, scoped }] } */
function format(R) {
  const L = [];
  L.push('SNIPER DUEL · MEDICIÓN DE RENDIMIENTO · ' + R.when + ' · versión ' + R.build);
  const d = R.device || {};
  L.push('Dispositivo: ' + (d.model || '?') + ' · pantalla ' + d.screen + ' · DPR ' + d.dpr + ' · ' + (d.touch ? 'táctil' : 'ratón'));
  L.push('GPU: ' + d.gpu + ' · WebGL ' + d.webgl + ' · textura máx. ' + d.maxTex + (d.heapMB ? ' · memoria JS ' + d.heapMB + ' MB' : ''));
  const s = R.settings || {};
  L.push('Ajustes: calidad ' + s.quality + ' (' + s.profile + ') · píxeles ×' + s.pixelRatio + ' (resolución fija durante la prueba) · límite ' + s.fpsCap + ' FPS · pantalla ~' + s.hz + ' Hz · pueblo ' + s.pueblo + (s.flags ? ' · banderas ' + s.flags : ''));
  const l = R.load || {};
  L.push('Carga de la página: HTML ' + fmtMs(l.html || 0) + ' · lista ' + fmtMs(l.dom || 0) + ' · todo cargado ' + fmtMs(l.load || 0) + ' · primer fotograma ' + fmtMs(l.firstFrame || 0) + ' · descargado ' + (l.mb || 0) + ' MB');
  if (l.big && l.big.length) L.push('  más pesados: ' + l.big.map(b => b.name + ' ' + b.mb + ' MB/' + fmtMs(b.ms)).join(' · '));
  for (const m of R.maps || []) {
    const f = m.frame, c = m.cpu, sc = m.scoped;
    L.push('');
    L.push('[' + m.name + '] entrar en la partida ' + fmtMs(m.loadMs));
    L.push('  fotograma: media ' + f.avg + ' ms · p50 ' + f.p50 + ' · p95 ' + f.p95 + ' · p99 ' + f.p99 + ' · máx ' + f.max + ' → ' + f.fps + ' FPS · tirones ' + f.jank + ' % · bajo 30 FPS ' + f.over33 + ' %');
    L.push('  CPU por fotograma (JavaScript + envío de dibujo): media ' + c.avg + ' ms · p95 ' + c.p95 + ' · ' + m.bound);
    if (sc && sc.n) L.push('  con la mira 8×: p50 ' + sc.p50 + ' ms · p95 ' + sc.p95 + ' → ' + sc.fps + ' FPS');
    if (m.parts) L.push('  ' + partsLine(m.parts));
    L.push('  dibujo: ' + m.calls.avg + ' llamadas (máx ' + m.calls.max + ') · ' + Math.round(m.tris.avg / 1000) + ' mil triángulos (máx ' + Math.round(m.tris.max / 1000) + ' mil) · ' + m.textures + ' texturas ≈ ' + m.texMB + ' MB · ' + m.geometries + ' geometrías');
  }
  return L.join('\n');
}
// GF-0 (30-10-2026): the frame's CPU time by part, biggest first (ms per drawn frame). bots and anim are inside sim/camara/red.
const PART_NAMES = { dibujo: 'envío de dibujo', sim: 'simulación', bots: 'bots (IA)', botsAnim: 'animación de bots', anim: 'animación de personajes', camara: 'cámara y tu personaje',
  arma1p: 'arma en 1ª persona', hud: 'HUD', efectos: 'efectos', red: 'red y rivales', mundo: 'mundo (LOD, flora, ratas)', dibujoArma: 'dibujo del arma', mirar: 'mirar', otros: 'otros' };
function partsLine(p) {
  const ks = Object.keys(PART_NAMES).filter(k => p[k] > 0).sort((a, b) => p[b] - p[a]);
  const extra = (p.animN ? ' · personajes animados por fotograma ' + p.animN : '') + (p.ticksN ? ' · pasos de simulación por fotograma ' + p.ticksN : '');
  return 'CPU por partes (ms por fotograma): ' + ks.map(k => PART_NAMES[k] + ' ' + p[k].toFixed(2)).join(' · ') + extra;
}
// the device's own name where the browser gives it (iPhone does not say which model: the screen size tells most)
function deviceName(ua, w, h, dpr) {
  ua = ua || '';
  const big = Math.max(w, h), small = Math.min(w, h);
  if (/iPhone/.test(ua)) {
    const k = big + 'x' + small + '@' + dpr;
    const T = { '932x430@3': 'iPhone Pro Max / Plus (14–16)', '926x428@3': 'iPhone 12–13 Pro Max', '852x393@3': 'iPhone 14 Pro–16', '844x390@3': 'iPhone 12–14', '896x414@2': 'iPhone XR/11', '667x375@2': 'iPhone 8/SE' };
    return T[k] || 'iPhone (' + k + ')';
  }
  const a = /Android[^;]*;\s*([^;)]+)/.exec(ua); if (a) return 'Android · ' + a[1].trim();
  if (/Windows/.test(ua)) return 'Windows PC'; if (/Macintosh/.test(ua)) return 'Mac';
  return 'desconocido';
}
const SDPerf = { stats, avgMax, textureMB, bound, format, deviceName, fmtMs };
if (typeof module !== 'undefined' && module.exports) module.exports = SDPerf; else root.SDPerf = SDPerf;
})(typeof window !== 'undefined' ? window : globalThis);
