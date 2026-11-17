/* Compila el C++ del juego (wasm/*.cpp) a WebAssembly con el clang de wasi-sdk (LLVM, gratuito y de código abierto).
   No hace falta para jugar ni para build.py: el .wasm compilado se guarda en assets/wasm/. Solo al cambiar el C++.
   node tools/wasm/build.js      env WASI_SDK=C:\ruta\a\wasi-sdk (por defecto C:\Users\Hamza\tools\wasi-sdk) */
'use strict';
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..', '..');
const SDK = process.env.WASI_SDK || path.join(os.homedir(), 'tools', 'wasi-sdk');
const clang = path.join(SDK, 'bin', process.platform === 'win32' ? 'clang++.exe' : 'clang++');
if (!fs.existsSync(clang)) { console.error('No encuentro clang en ' + clang + ' (wasi-sdk: https://github.com/WebAssembly/wasi-sdk/releases)'); process.exit(1); }
for (const name of ['nav']) {
  const src = path.join(ROOT, 'wasm', name + '.cpp'), out = path.join(ROOT, 'assets', 'wasm', name + '.wasm');
  // freestanding: sin biblioteca estándar ni punto de entrada; solo las funciones marcadas export_name
  execFileSync(clang, ['--target=wasm32', '-O3', '-nostdlib', '-fno-exceptions', '-fno-rtti', '-ffreestanding', '-Wall',
    '-Wl,--no-entry', '-Wl,--strip-all', '-Wl,--export=__heap_base', '-o', out, src], { stdio: 'inherit' });
  console.log(path.relative(ROOT, out), fs.statSync(out).size, 'bytes');
}
