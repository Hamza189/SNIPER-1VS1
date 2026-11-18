// SNIPER DUEL — las rutas de los bots del SERVIDOR (A*) en C++ → WebAssembly (18-11-2026, ENGINE NEXT GENERATION;
// docs/WASM.md). core/bots.js lo usa si está cargado (Node: desde el disco; Cloudflare: lo importa server/worker.js) y si
// no, sigue con su A* en JavaScript.
//
// Medido antes (core/bots.js astar, Node, este PC): BARRIO 18 ms de media por ruta y 190 ms la peor; la lista abierta se
// recorría entera en cada paso. Aquí: la misma búsqueda (mismo coste y la misma heurística: distancia en línea recta,
// el mismo tope de 6 000 nodos) con un montículo binario, y la red copiada una sola vez por mapa.
// Las rutas pueden diferir de las de JavaScript solo en los empates (otra ruta igual de corta).
//
// Sin biblioteca estándar: memoria que solo crece (una red por mapa, como mucho 16) y sqrt de WebAssembly.

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
static inline double dist(double ax, double az, double bx, double bz) { double dx = ax - bx, dz = az - bz; return __builtin_sqrt(dx * dx + dz * dz); }

struct Graph {
  int n; double* x; double* z; int* off; int* adj;
  double* g; int* from; u32* seen; u32* closed; u32 stamp;   // per search, reset by stamp (no clearing of n entries)
  double* hf; int* hn; int hsize;                             // binary heap of (f, node): pushes may repeat a node
};
static Graph graphs[16]; static int nGraphs = 0;
static int* pathOut = 0; static int pathCap = 0;

// ---- entrada de una red: la capa JavaScript escribe aquí los puntos y los vecinos y llama a astar_commit
static double* inX = 0; static double* inZ = 0; static int* inOff = 0; static int* inAdj = 0; static int inN = 0, inA = 0;

static void heapPush(Graph& G, double f, int node) {
  int i = G.hsize++; G.hf[i] = f; G.hn[i] = node;
  while (i > 0) { int p = (i - 1) >> 1; if (G.hf[p] <= G.hf[i]) break;
    double tf = G.hf[p]; G.hf[p] = G.hf[i]; G.hf[i] = tf; int tn = G.hn[p]; G.hn[p] = G.hn[i]; G.hn[i] = tn; i = p; }
}
static int heapPop(Graph& G) {
  int top = G.hn[0]; G.hsize--;
  if (G.hsize > 0) {
    G.hf[0] = G.hf[G.hsize]; G.hn[0] = G.hn[G.hsize]; int i = 0;
    for (;;) { int l = 2 * i + 1, r = l + 1, m = i;
      if (l < G.hsize && G.hf[l] < G.hf[m]) m = l; if (r < G.hsize && G.hf[r] < G.hf[m]) m = r; if (m == i) break;
      double tf = G.hf[m]; G.hf[m] = G.hf[i]; G.hf[i] = tf; int tn = G.hn[m]; G.hn[m] = G.hn[i]; G.hn[i] = tn; i = m; }
  }
  return top;
}

extern "C" {
// 1) reservar la entrada de una red de n puntos y a enlaces (lista de vecinos de todos los puntos)
__attribute__((export_name("astar_input"))) int astar_input(int n, int a) {
  inN = n; inA = a; inX = take<double>((u32)n); inZ = take<double>((u32)n); inOff = take<int>((u32)n + 1); inAdj = take<int>((u32)a);
  return 0;
}
__attribute__((export_name("astar_in_x"))) double* astar_in_x() { return inX; }
__attribute__((export_name("astar_in_z"))) double* astar_in_z() { return inZ; }
__attribute__((export_name("astar_in_off"))) int* astar_in_off() { return inOff; }
__attribute__((export_name("astar_in_adj"))) int* astar_in_adj() { return inAdj; }
// 2) quedársela: devuelve su número (o −1 si ya hay 16)
__attribute__((export_name("astar_commit"))) int astar_commit() {
  if (nGraphs >= 16) return -1;
  Graph& G = graphs[nGraphs]; G.n = inN; G.x = inX; G.z = inZ; G.off = inOff; G.adj = inAdj;
  G.g = take<double>((u32)inN); G.from = take<int>((u32)inN); G.seen = take<u32>((u32)inN); G.closed = take<u32>((u32)inN); G.stamp = 0;
  for (int i = 0; i < inN; i++) { G.seen[i] = 0; G.closed[i] = 0; }
  G.hf = take<double>((u32)inA + 8u); G.hn = take<int>((u32)inA + 8u); G.hsize = 0;   // each push comes from a link: at most a + 1
  if (pathCap < inN) { pathOut = take<int>((u32)inN); pathCap = inN; }
  return nGraphs++;
}
__attribute__((export_name("astar_path"))) int* astar_path() { return pathOut; }
// 3) una ruta de s a t: devuelve su largo (puntos en astar_path(), de s a t) o 0 si no hay
__attribute__((export_name("astar_find"))) int astar_find(int gi, int s, int t, int maxIt) {
  if (gi < 0 || gi >= nGraphs) return 0; Graph& G = graphs[gi];
  if (s < 0 || t < 0 || s >= G.n || t >= G.n) return 0;
  if (s == t) { pathOut[0] = s; return 1; }
  u32 st = ++G.stamp; if (!st) { for (int i = 0; i < G.n; i++) { G.seen[i] = 0; G.closed[i] = 0; } st = G.stamp = 1; }
  const double tx = G.x[t], tz = G.z[t];
  G.hsize = 0; G.seen[s] = st; G.g[s] = 0; G.from[s] = -1; heapPush(G, dist(G.x[s], G.z[s], tx, tz), s);
  int it = 0; bool found = false;
  while (G.hsize && it++ < maxIt) {
    int cur = heapPop(G);
    if (cur == t) { found = true; break; }
    if (G.closed[cur] == st) continue; G.closed[cur] = st;
    for (int q = G.off[cur]; q < G.off[cur + 1]; q++) {
      int nb = G.adj[q]; double c = G.g[cur] + dist(G.x[nb], G.z[nb], G.x[cur], G.z[cur]);
      if (G.seen[nb] != st || c < G.g[nb]) { G.seen[nb] = st; G.g[nb] = c; G.from[nb] = cur; heapPush(G, c + dist(G.x[nb], G.z[nb], tx, tz), nb); }
    }
  }
  if (!found && G.seen[t] != st) return 0;
  int len = 0; for (int c = t; c != -1; c = G.from[c]) { pathOut[len++] = c; if (len > G.n) return 0; }
  for (int i = 0, j = len - 1; i < j; i++, j--) { int tmp = pathOut[i]; pathOut[i] = pathOut[j]; pathOut[j] = tmp; }
  return len;
}
}
