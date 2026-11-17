// SNIPER DUEL — la red por la que andan los bots, en C++ compilado a WebAssembly (17-11-2026; ENGINE NEXT GENERATION,
// docs/claude-code/ENGINE_NEXT_GEN_INFORME.md, conclusión C). La primera pieza del juego en C++.
//
// Hace exactamente lo mismo que navGrid() de client/casa2.js (que sigue siendo la versión de reserva), en el mismo orden,
// para que el resultado sea idéntico punto por punto y enlace por enlace (test/navwasm.test.js lo comprueba):
//   · puntos cada 0,25 m en el rectángulo ±XO × ±ZN, fuera de las cajas que estorban al cuerpo (con R de margen)
//   · enlaces con los 8 vecinos si la línea entre ellos está libre (comprobada a 1/4, 1/2 y 3/4)
//   · se queda el trozo conectado más grande, renumerado en el mismo orden
// Las cajas van en cubos de 2 m (como el Map de la versión JavaScript, pero en tablas planas).
//
// Sin biblioteca estándar (ni malloc ni libm): una memoria que solo crece y las instrucciones de WebAssembly para
// floor y redondeo. Compilar: node tools/wasm/build.js  → assets/wasm/nav.wasm

typedef unsigned int u32;
extern "C" unsigned char __heap_base;

// ---- memoria: un montón que solo avanza; nav_reset() lo vacía antes de cada mapa
static u32 heapTop = 0;
template <typename T> static T* take(u32 count) {
  if (!heapTop) heapTop = ((u32)(unsigned long)&__heap_base + 15u) & ~15u;
  u32 bytes = (count ? count : 1u) * (u32)sizeof(T), p = heapTop, end = p + ((bytes + 15u) & ~15u);
  u32 have = (u32)__builtin_wasm_memory_size(0) * 65536u;
  if (end > have) __builtin_wasm_memory_grow(0, (end - have + 65535u) / 65536u);
  heapTop = end;
  return (T*)(unsigned long)p;
}
static inline double floorD(double v) { return __builtin_floor(v); }
// +(v).toFixed(2) de JavaScript para los valores de la rejilla (múltiplos de 0,25 desde un borde con 2 decimales)
static inline double round2(double v) { return __builtin_nearbyint(v * 100.0) / 100.0; }

// ---- entrada y salida (las lee client/navwasm.js)
static double* boxIn = 0;                               // n × 6: minX, minY, minZ, maxX, maxY, maxZ
static double* outX = 0; static double* outZ = 0;
static int* outOff = 0; static int* outAdj = 0;          // vecinos del punto k: outAdj[outOff[k] .. outOff[k+1])

// ---- las cajas en cubos de 2 m, de −128 m a +128 m (el mapa más grande mide ±28 m)
static const double B = 2.0; static const int NB = 64, SIDE = 2 * NB;
static int* bStart = 0; static int* bList = 0;
static inline int cellOf(int i, int j) { return (i + NB >= 0 && i + NB < SIDE && j + NB >= 0 && j + NB < SIDE) ? (i + NB) * SIDE + (j + NB) : -1; }
static bool blk(double x, double z, double r) {
  int k = cellOf((int)floorD(x / B), (int)floorD(z / B)); if (k < 0) return false;
  for (int q = bStart[k]; q < bStart[k + 1]; q++) { const double* c = boxIn + bList[q] * 6;
    if (x > c[0] - r && x < c[3] + r && z > c[2] - r && z < c[5] + r) return true; }
  return false;
}
static void bucket(int nBox, double step, double standH, double R) {
  int* cnt = take<int>(SIDE * SIDE + 1); for (int k = 0; k <= SIDE * SIDE; k++) cnt[k] = 0;
  for (int pass = 0; pass < 2; pass++) {
    if (pass == 1) {   // contados: cada cubo empieza donde acaba el anterior
      bStart = take<int>(SIDE * SIDE + 1); int s = 0;
      for (int k = 0; k < SIDE * SIDE; k++) { bStart[k] = s; s += cnt[k]; cnt[k] = bStart[k]; }
      bStart[SIDE * SIDE] = s; bList = take<int>((u32)s);
    }
    for (int b = 0; b < nBox; b++) {
      const double* c = boxIn + b * 6; if (!(c[4] > step && c[1] < standH)) continue;   // solo lo que estorba al cuerpo
      int i0 = (int)floorD((c[0] - R) / B), i1 = (int)floorD((c[3] + R) / B), j0 = (int)floorD((c[2] - R) / B), j1 = (int)floorD((c[5] + R) / B);
      for (int i = i0; i <= i1; i++) for (int j = j0; j <= j1; j++) { int k = cellOf(i, j); if (k < 0) continue; if (pass == 0) cnt[k]++; else bList[cnt[k]++] = b; }
    }
  }
}

extern "C" {
__attribute__((export_name("nav_reset"))) void nav_reset() { heapTop = 0; boxIn = 0; outX = outZ = 0; outOff = outAdj = 0; bStart = bList = 0; }
__attribute__((export_name("nav_boxes"))) double* nav_boxes(int n) { return boxIn = take<double>((u32)n * 6u); }
__attribute__((export_name("nav_x"))) double* nav_x() { return outX; }
__attribute__((export_name("nav_z"))) double* nav_z() { return outZ; }
__attribute__((export_name("nav_off"))) int* nav_off() { return outOff; }
__attribute__((export_name("nav_adj"))) int* nav_adj() { return outAdj; }

// devuelve cuántos puntos tiene la red (las cajas ya escritas en nav_boxes(nBox))
__attribute__((export_name("nav_build"))) int nav_build(int nBox, double step, double standH, double R, double XO, double ZN) {
  const double G = 0.25;
  bucket(nBox, step, standH, R);
  // 1) los puntos de la rejilla, fuera de las cajas
  const int NX = (int)__builtin_nearbyint(2.0 * XO / G), NZ = (int)__builtin_nearbyint(2.0 * ZN / G), W = NZ + 1;
  const u32 cells = (u32)(NX + 1) * (u32)W;
  int* cell = take<int>(cells); double* px = take<double>(cells); double* pz = take<double>(cells);
  int* pi = take<int>(cells); int* pj = take<int>(cells); int all = 0;
  for (int i = 0; i <= NX; i++) for (int j = 0; j <= NZ; j++) {
    double X = round2(-XO + i * G), Z = round2(-ZN + j * G);
    if (blk(X, Z, R)) { cell[i * W + j] = -1; continue; }
    cell[i * W + j] = all; px[all] = X; pz[all] = Z; pi[all] = i; pj[all] = j; all++;
  }
  // 2) enlaces con los 8 vecinos, en el mismo orden que la versión JavaScript
  static const int DI[8] = { 1, -1, 0, 0, 1, 1, -1, -1 }, DJ[8] = { 0, 0, 1, -1, 1, -1, 1, -1 };
  int* off = take<int>((u32)all + 1); int* adj = take<int>((u32)all * 8u); int na = 0;
  for (int k = 0; k < all; k++) {
    off[k] = na;
    for (int d = 0; d < 8; d++) {
      int i = pi[k] + DI[d], j = pj[k] + DJ[d]; if (i < 0 || j < 0 || i > NX || j > NZ) continue;
      int m = cell[i * W + j]; if (m < 0) continue;
      bool ok = true; for (double t = 0.25; t < 1.0; t += 0.25) if (blk(px[k] + DI[d] * G * t, pz[k] + DJ[d] * G * t, R)) { ok = false; break; }
      if (ok) adj[na++] = m;
    }
  }
  off[all] = na;
  // 3) el trozo conectado más grande (recorrido con pila, como q.pop()), renumerado en orden
  int* comp = take<int>((u32)all); int* stack = take<int>((u32)all); int* size = take<int>((u32)all); int nComp = 0;
  for (int k = 0; k < all; k++) comp[k] = -1;
  for (int s = 0; s < all; s++) {
    if (comp[s] >= 0) continue; int c = nComp++, sp = 0, m = 0; stack[sp++] = s; comp[s] = c;
    while (sp) { int k = stack[--sp]; m++; for (int q = off[k]; q < off[k + 1]; q++) { int j = adj[q]; if (comp[j] < 0) { comp[j] = c; stack[sp++] = j; } } }
    size[c] = m;
  }
  if (!nComp) return 0;
  int big = 0; for (int c = 1; c < nComp; c++) if (size[c] > size[big]) big = c;   // empate: el primero (indexOf del máximo)
  int* re = take<int>((u32)all); int n = 0;
  for (int k = 0; k < all; k++) re[k] = comp[k] == big ? n++ : -1;
  outX = take<double>((u32)n); outZ = take<double>((u32)n); outOff = take<int>((u32)n + 1); outAdj = take<int>((u32)na);
  int w = 0;
  for (int k = 0; k < all; k++) {
    if (re[k] < 0) continue; int r = re[k]; outX[r] = px[k]; outZ[r] = pz[k]; outOff[r] = w;
    for (int q = off[k]; q < off[k + 1]; q++) outAdj[w++] = re[adj[q]];
  }
  outOff[n] = w;
  return n;
}
}
