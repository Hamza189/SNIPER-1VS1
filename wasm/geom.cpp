// SNIPER DUEL — balas y líneas de visión del SERVIDOR contra los triángulos del mapa, en C++ → WebAssembly
// (18-11-2026, ENGINE NEXT GENERATION; docs/WASM.md). Es segMap() de core/geom.js: core/geom.js lo usa si está cargado
// (Node: desde el disco; Cloudflare: lo importa server/worker.js) y si no, sigue con su versión JavaScript.
//
// Medido antes (perfil de CPU del servidor, CASA ATLAS 2.0 con 5 bots): triHit + segMap eran el 45 % del tiempo del
// servidor (balas, la vista de los bots, los sitios de aparición y el cuchillo).
//
// TIENE QUE DAR EXACTAMENTE LO MISMO QUE JAVASCRIPT (son las balas autoritativas): las mismas operaciones en doble
// precisión y en el mismo orden (Möller–Trumbore, la misma rejilla de 4 m, el mismo «más cerca gana»), sin -ffast-math
// ni contracción a FMA. test/geomwasm.test.js lo compara bit a bit con cientos de miles de segmentos en todos los mapas.
//
// Sin biblioteca estándar: memoria que solo crece (un mapa por índice, como mucho 32).

typedef unsigned int u32;
extern "C" unsigned char __heap_base;
static u32 heapTop = 0;
template <typename T> static T* take(u32 count) {
  if (!heapTop) heapTop = ((u32)(unsigned long)&__heap_base + 15u) & ~15u;
  u32 bytes = (count ? count : 1u) * (u32)sizeof(T), p = heapTop, end = p + ((bytes + 15u) & ~15u);
  u32 have = (u32)__builtin_wasm_memory_size(0) * 65536u;
  if (end > have) __builtin_wasm_memory_grow(0, (end - have + 65535u) / 65536u);
  heapTop = end;
  return (T*)(unsigned long)p;
}
static const double CELL = 4.0, EPS = 1e-9;
static inline double mn3(double a, double b, double c) { double m = a < b ? a : b; return m < c ? m : c; }
static inline double mx3(double a, double b, double c) { double m = a > b ? a : b; return m > c ? m : c; }
static inline int cellOf(double v) { return (int)__builtin_floor(v / CELL); }

struct Index {
  int n; double* T; unsigned char* ds;          // ds: 1 = las dos caras (null = todas de una cara)
  int gx0, gz0, gw, gh; int* off; int* tri;     // rejilla XZ densa: celdas [gx0, gx0+gw) × [gz0, gz0+gh)
  int nBig; int* big;                           // triángulos de más de 60 m (el suelo): se prueban siempre
  u32* stamp; u32 mark;
};
static Index idx[32]; static int nIdx = 0;

// ---- entrada: la capa JavaScript escribe los triángulos (y ds) aquí y llama a geom_commit
static double* inT = 0; static unsigned char* inDs = 0; static int inN = 0, inCap = 0;
extern "C" __attribute__((export_name("geom_input"))) void geom_input(int n) {
  if (n > inCap) { inT = take<double>((u32)n * 9u); inDs = take<unsigned char>((u32)n); inCap = n; }
  inN = n;
}
extern "C" __attribute__((export_name("geom_in_t"))) double* geom_in_t() { return inT; }
extern "C" __attribute__((export_name("geom_in_ds"))) unsigned char* geom_in_ds() { return inDs; }

// hasDs: 0 = ningún triángulo de dos caras (como un mapa sin ds), 1 = usar inDs
extern "C" __attribute__((export_name("geom_commit"))) int geom_commit(int hasDs) {
  if (nIdx >= 32) return -1;
  Index& X = idx[nIdx];
  const int n = inN; X.n = n;
  X.T = take<double>((u32)n * 9u); for (int k = 0; k < n * 9; k++) X.T[k] = inT[k];
  X.ds = 0; if (hasDs) { X.ds = take<unsigned char>((u32)n); for (int k = 0; k < n; k++) X.ds[k] = inDs[k]; }
  // pasada 1: límites de la rejilla y cuántos triángulos grandes
  int x0 = 0x7fffffff, x1 = -0x7fffffff, z0 = 0x7fffffff, z1 = -0x7fffffff, nb = 0;
  const double* T = X.T;
  for (int i = 0; i < n; i++) {
    const int o = i * 9;
    const double minX = mn3(T[o], T[o + 3], T[o + 6]), maxX = mx3(T[o], T[o + 3], T[o + 6]);
    const double minZ = mn3(T[o + 2], T[o + 5], T[o + 8]), maxZ = mx3(T[o + 2], T[o + 5], T[o + 8]);
    if (maxX - minX > 60 || maxZ - minZ > 60) { nb++; continue; }
    const int a = cellOf(minX), b = cellOf(maxX), c = cellOf(minZ), d = cellOf(maxZ);
    if (a < x0) x0 = a; if (b > x1) x1 = b; if (c < z0) z0 = c; if (d > z1) z1 = d;
  }
  if (x1 < x0) { x0 = x1 = z0 = z1 = 0; }
  X.gx0 = x0; X.gz0 = z0; X.gw = x1 - x0 + 1; X.gh = z1 - z0 + 1;
  const int cells = X.gw * X.gh;
  X.off = take<int>((u32)cells + 1u); for (int k = 0; k <= cells; k++) X.off[k] = 0;
  X.big = take<int>((u32)nb); X.nBig = 0;
  // pasada 2: cuántos en cada celda; pasada 3: rellenar (en orden de triángulo, como JavaScript)
  for (int pass = 0; pass < 2; pass++) {
    int* fill = 0;
    if (pass == 1) {
      for (int k = 0; k < cells; k++) X.off[k + 1] += X.off[k];
      X.tri = take<int>((u32)X.off[cells]);
      fill = take<int>((u32)cells); for (int k = 0; k < cells; k++) fill[k] = X.off[k];
    }
    for (int i = 0; i < n; i++) {
      const int o = i * 9;
      const double minX = mn3(T[o], T[o + 3], T[o + 6]), maxX = mx3(T[o], T[o + 3], T[o + 6]);
      const double minZ = mn3(T[o + 2], T[o + 5], T[o + 8]), maxZ = mx3(T[o + 2], T[o + 5], T[o + 8]);
      if (maxX - minX > 60 || maxZ - minZ > 60) { if (pass == 1) X.big[X.nBig++] = i; continue; }
      for (int cx = cellOf(minX); cx <= cellOf(maxX); cx++)
        for (int cz = cellOf(minZ); cz <= cellOf(maxZ); cz++) {
          const int k = (cx - x0) * X.gh + (cz - z0);
          if (pass == 0) X.off[k + 1]++; else X.tri[fill[k]++] = i;
        }
    }
  }
  X.stamp = take<u32>((u32)n); for (int k = 0; k < n; k++) X.stamp[k] = 0; X.mark = 0;
  return nIdx++;
}

// el rayo (origen o, dirección unitaria d) contra el triángulo i → distancia o −1 (igual que triHit de core/geom.js)
static inline double triHit(const double* T, int i, double ox, double oy, double oz, double dx, double dy, double dz, bool both) {
  const int o = i * 9;
  const double ax = T[o], ay = T[o + 1], az = T[o + 2];
  const double e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az;
  const double e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
  const double px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
  const double det = e1x * px + e1y * py + e1z * pz;
  if (both ? (det > -EPS && det < EPS) : det < EPS) return -1;
  const double inv = 1 / det, tx = ox - ax, ty = oy - ay, tz = oz - az;
  const double u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) return -1;
  const double qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const double v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) return -1;
  const double t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t >= 0 ? t : -1;
}

// el primer triángulo del mapa a lo largo del segmento → su distancia, o −1 si no hay ninguno (segMap de core/geom.js)
extern "C" __attribute__((export_name("geom_seg"))) double geom_seg(int h, double ox, double oy, double oz,
                                                                     double dx, double dy, double dz, double len, double nr) {
  if (h < 0 || h >= nIdx) return -2;
  Index& X = idx[h];
  double best = __builtin_inf();
  X.mark = X.mark + 1u; if (X.mark == 0u) { for (int k = 0; k < X.n; k++) X.stamp[k] = 0; X.mark = 1u; }
  const double x1 = ox + dx * len, z1 = oz + dz * len;
  int c0x = cellOf(ox < x1 ? ox : x1), c1x = cellOf(ox > x1 ? ox : x1);
  int c0z = cellOf(oz < z1 ? oz : z1), c1z = cellOf(oz > z1 ? oz : z1);
  // fuera de la rejilla no hay triángulos (JavaScript las mira y no encuentra nada)
  if (c0x < X.gx0) c0x = X.gx0; if (c1x > X.gx0 + X.gw - 1) c1x = X.gx0 + X.gw - 1;
  if (c0z < X.gz0) c0z = X.gz0; if (c1z > X.gz0 + X.gh - 1) c1z = X.gz0 + X.gh - 1;
  const double* T = X.T;
  for (int cx = c0x; cx <= c1x; cx++) for (int cz = c0z; cz <= c1z; cz++) {
    const int k = (cx - X.gx0) * X.gh + (cz - X.gz0);
    for (int j = X.off[k], e = X.off[k + 1]; j < e; j++) {
      const int i = X.tri[j]; if (X.stamp[i] == X.mark) continue; X.stamp[i] = X.mark;
      const double t = triHit(T, i, ox, oy, oz, dx, dy, dz, !X.ds || X.ds[i] == 1);
      if (t >= nr && t <= len && t < best) best = t;
    }
  }
  for (int j = 0; j < X.nBig; j++) {
    const int i = X.big[j];
    const double t = triHit(T, i, ox, oy, oz, dx, dy, dz, !X.ds || X.ds[i] == 1);
    if (t >= nr && t <= len && t < best) best = t;
  }
  return best == __builtin_inf() ? -1 : best;
}
