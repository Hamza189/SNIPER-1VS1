// Archivos grandes del juego desde Cloudflare R2 (30-10-2026, docs/R2.md): las texturas KTX2 de personajes y armas.
// Va aparte del servidor multijugador (server/worker.js) para no tocarlo nunca al subir texturas.
//   GET/HEAD /<ruta>   el archivo, con CORS para la página (son archivos públicos del juego)
//   PUT/DELETE /<ruta> solo con la cabecera x-clave = secreto UPLOAD_KEY (tools/r2-subir.js; nunca en la página)
const TYPES = { glb: 'model/gltf-binary', ktx2: 'image/ktx2', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  json: 'application/json', bin: 'application/octet-stream', hdr: 'image/vnd.radiance', mp3: 'audio/mpeg', ogg: 'audio/ogg' };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-expose-headers': 'etag, content-length' };

function keyOf(url) {
  let k;
  try { k = decodeURIComponent(new URL(url).pathname.slice(1)); } catch (e) { return null; }
  return /^assets\/[\w\-./]+$/.test(k) && !k.includes('..') ? k : null;
}
async function same(a, b) {
  const e = new TextEncoder(), x = e.encode(a || ''), y = e.encode(b || '');
  return x.byteLength === y.byteLength && crypto.subtle.timingSafeEqual(x, y);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const key = keyOf(req.url);
    if (!key) return new Response('no', { status: 404, headers: CORS });
    if (req.method === 'PUT' || req.method === 'DELETE') {
      if (!env.UPLOAD_KEY || !(await same(req.headers.get('x-clave'), env.UPLOAD_KEY))) return new Response('no', { status: 403 });
      if (req.method === 'DELETE') { await env.B.delete(key); return new Response('ok'); }
      const ext = key.split('.').pop().toLowerCase();
      const o = await env.B.put(key, req.body, { httpMetadata: { contentType: TYPES[ext] || 'application/octet-stream' } });
      return Response.json({ key, size: o.size, etag: o.etag });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('no', { status: 405, headers: CORS });
    const o = req.method === 'HEAD' ? await env.B.head(key) : await env.B.get(key, { onlyIf: req.headers });
    if (!o) return new Response('no', { status: 404, headers: CORS });
    const h = new Headers(CORS);
    o.writeHttpMetadata(h);
    h.set('etag', o.httpEtag);
    // the textures are named by their content (ktx2/*.<hash>.ktx2) or asked for with ?v=<build>: a day is safe
    h.set('cache-control', 'public, max-age=86400');
    if (req.method === 'HEAD') { h.set('content-length', String(o.size)); return new Response(null, { headers: h }); }
    if (!('body' in o) || !o.body) return new Response(null, { status: 304, headers: h });
    return new Response(o.body, { headers: h });
  },
};
