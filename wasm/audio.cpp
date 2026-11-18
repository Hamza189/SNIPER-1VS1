// SNIPER DUEL — el sonido que se genera al empezar, en C++ → WebAssembly (18-11-2026; docs/WASM.md).
// audioInit() (src/page.html) genera, en el primer toque, 2 s de ruido blanco (el viento y los disparos) y la
// reverberación del pueblo: 2,4 s en estéreo de ruido que se apaga como (1 − t)^3,4 con 10 ms de entrada. En JavaScript
// son ~330 000 muestras con Math.random y Math.pow: 30–90 ms de CPU en el PC, en el momento de tocar para jugar.
// Aquí, lo mismo con un generador xorshift y la potencia con exp2/log2 (~1e-7) cada 32 muestras, en línea recta entre
// medias: la curva es suave y el oído no distingue nada (la prueba compara la energía por tramos).
// Sin biblioteca estándar.

typedef unsigned int u32;
extern "C" unsigned char __heap_base;
static u32 heapTop = 0;
static float* take(u32 count) {
  if (!heapTop) heapTop = ((u32)(unsigned long)&__heap_base + 15u) & ~15u;
  u32 bytes = (count ? count : 1u) * 4u, p = heapTop, end = p + ((bytes + 15u) & ~15u);
  u32 have = (u32)__builtin_wasm_memory_size(0) * 65536u;
  if (end > have) __builtin_wasm_memory_grow(0, (end - have + 65535u) / 65536u);
  heapTop = end; return (float*)(unsigned long)p;
}
static u32 rs = 0x9E3779B9u;
static inline float noise() { rs ^= rs << 13; rs ^= rs >> 17; rs ^= rs << 5; return (float)(int)rs * (1.0f / 2147483648.0f); }   // [−1, 1)

// log2 y exp2 para x en (0, 1]: separar exponente y mantisa (bits del double) y un polinomio
static inline double log2d(double x) {
  union { double d; unsigned long long u; } v; v.d = x;
  int e = (int)((v.u >> 52) & 0x7FF) - 1023; v.u = (v.u & 0x000FFFFFFFFFFFFFull) | 0x3FF0000000000000ull;   // m en [1, 2)
  double m = v.d, t = (m - 1.0) / (m + 1.0), t2 = t * t;                                                        // ln m = 2·atanh(t)
  double ln = 2.0 * t * (1.0 + t2 * (1.0 / 3 + t2 * (1.0 / 5 + t2 * (1.0 / 7 + t2 * (1.0 / 9 + t2 * (1.0 / 11 + t2 / 13))))));
  return e + ln * 1.4426950408889634;
}
static inline double exp2d(double y) {
  double fi = __builtin_floor(y), f = y - fi; int i = (int)fi;
  if (i < -1000) return 0.0;
  double x = f * 0.6931471805599453, s = 1.0, term = 1.0;                                                       // e^x, x en [0, ln 2)
  for (int k = 1; k < 14; k++) { term *= x / k; s += term; }
  union { double d; unsigned long long u; } v; v.u = (unsigned long long)(i + 1023) << 52; return s * v.d;
}
static inline double powd(double b, double e) { return b <= 0.0 ? 0.0 : exp2d(e * log2d(b)); }

static float* outNoise = 0; static float* outL = 0; static float* outR = 0;
extern "C" {
__attribute__((export_name("au_noise"))) float* au_noise() { return outNoise; }
__attribute__((export_name("au_ir_l"))) float* au_ir_l() { return outL; }
__attribute__((export_name("au_ir_r"))) float* au_ir_r() { return outR; }
// todo de una vez: n muestras de ruido y una reverberación de rl muestras por canal (sr: muestras por segundo)
__attribute__((export_name("au_make"))) void au_make(int n, int rl, double sr, u32 seed) {
  heapTop = 0; rs = seed ? seed : 0x9E3779B9u;
  outNoise = take((u32)n); for (int i = 0; i < n; i++) outNoise[i] = noise();
  outL = take((u32)rl); outR = take((u32)rl);
  const double att = sr * 0.01;   // 10 ms de entrada
  // the decay curve is smooth: the power every 32 samples and a straight line in between (error < 1e-7)
  const int K = 32;
  for (int ch = 0; ch < 2; ch++) { float* d = ch ? outR : outL;
    double e0 = powd(1.0, 3.4);
    for (int b = 0; b < rl; b += K) {
      int end = b + K < rl ? b + K : rl; double e1 = powd(1.0 - (double)end / rl, 3.4), de = (e1 - e0) / (end - b), env = e0;
      for (int i = b; i < end; i++, env += de) d[i] = noise() * (float)(env * (i < att ? i / att : 1.0));
      e0 = e1;
    } }
}
// para la prueba: la potencia de aquí (comparada con Math.pow)
__attribute__((export_name("au_pow"))) double au_pow(double b, double e) { return powd(b, e); }
}
