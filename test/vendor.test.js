/* The standalone page loads its own copy of Three.js. Check it is there, is r128 and really
   defines window.THREE, so the page does not depend on a CDN. Run: node test/vendor.test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const file = path.join(root, 'vendor', 'three.min.js');
console.log('\nTHREE.JS PROPIO');
check('index.html carga vendor/three.min.js antes que el juego', html.indexOf('<script src="vendor/three.min.js">') !== -1 && html.indexOf('vendor/three.min.js') < html.indexOf('loadErr\').hidden'));
check('si falla, hay respaldo en dos CDN', /jsdelivr[^\n]*three@0\.128\.0/.test(html) && /cdnjs[^\n]*r128/.test(html));
check('el archivo existe', fs.existsSync(file));
const win = {}; win.window = win; win.self = win;
let rev = null;
try { vm.runInNewContext(fs.readFileSync(file, 'utf8'), win); rev = win.THREE && win.THREE.REVISION; } catch (e) { console.log(e.message); }
check('el archivo define window.THREE r128', rev === '128', 'REVISION ' + rev);
check('trae lo que usa el juego', !!(win.THREE && win.THREE.WebGLRenderer && win.THREE.ExtrudeGeometry && win.THREE.CubeTexture));
// the GLTF loader for the modelled weapons (official r128 example script)
const gl = path.join(root, 'vendor', 'GLTFLoader.js');
check('index.html carga vendor/GLTFLoader.js después de Three.js', html.indexOf('<script src="vendor/GLTFLoader.js">') > html.indexOf('vendor/three.min.js'));
let okL = false; try { const w2 = {}; w2.window = w2; vm.runInNewContext(fs.readFileSync(file, 'utf8'), w2); vm.runInNewContext(fs.readFileSync(gl, 'utf8'), Object.assign(w2, { THREE: w2.THREE })); okL = typeof w2.THREE.GLTFLoader === 'function'; } catch (e) { console.log(e.message); }
check('GLTFLoader define THREE.GLTFLoader', okL);
check('existe assets/viewmodels.glb (modelos 3D de las armas y los brazos)', fs.existsSync(path.join(root, 'assets', 'viewmodels.glb')) && fs.readFileSync(path.join(root, 'assets', 'viewmodels.glb')).slice(0, 4).toString() === 'glTF');
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
