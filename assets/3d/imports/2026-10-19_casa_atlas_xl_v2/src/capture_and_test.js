'use strict';
const path=require('path'),fs=require('fs'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../../../..');
const {chromium}=require(path.join(repo,'node_modules/playwright'));
const executablePath=[chromium.executablePath(),'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p=>fs.existsSync(p)); // Resolve installed browser before isolating caches.
assert(executablePath,'No Chromium/Chrome/Edge executable found');
const runtime=path.join(root,'.work');
for(const name of ['tmp','cache','profile','appdata','localappdata'])fs.mkdirSync(path.join(runtime,name),{recursive:true});
Object.assign(process.env,{TEMP:path.join(runtime,'tmp'),TMP:path.join(runtime,'tmp'),TMPDIR:path.join(runtime,'tmp'),APPDATA:path.join(runtime,'appdata'),LOCALAPPDATA:path.join(runtime,'localappdata'),XDG_CACHE_HOME:path.join(runtime,'cache')});
const ss=require(path.join(repo,'tools/static-server'));
(async()=>{
 const server=await ss.start();let context;
 const results={views:{},errors:[],game:{},model_sha256:Object.fromEntries(['sd_casa_atlas_xl_v2.glb','sd_casa_atlas_xl_v2_techo.glb'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'models',n))).digest('hex')]))};
 try{
 context=await chromium.launchPersistentContext(path.join(runtime,'profile'),{executablePath,headless:true,viewport:{width:1280,height:720},args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-breakpad','--disable-crash-reporter','--disk-cache-dir='+path.join(runtime,'cache')],env:process.env});
 const p=await context.newPage();p.on('pageerror',e=>results.errors.push(e.message));
 for(const version of ['v2','v1']){
   await p.goto(server.url+'assets/3d/imports/2026-10-19_casa_atlas_xl_v2/viewer.html?version='+version);
   await p.waitForFunction(()=>window.ready,{},{timeout:120000});
   results[version]=await p.evaluate(()=>audit());
   for(const view of ['calle','patio','pergola','interior','jardin','garaje']){
     await p.evaluate(key=>setView(key),view);
     await p.screenshot({path:path.join(root,'preview',version+'_'+view+'.png')});
     results.views[version+'_'+view]=await p.evaluate(()=>({position:camera.position.toArray(),target:views[active].t,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}));
   }
 }
 assert.equal(results.v2.triangles,JSON.parse(fs.readFileSync(path.join(root,'stats.json'))).total_triangles);
 assert.equal(results.v2.three,'128');
 // Substitute the two GLB responses only in this test browser. Production files
 // and game code remain untouched; real current movement/bots/navigation run.
 const g=await context.newPage();g.on('pageerror',e=>results.errors.push(e.message));
 await g.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await g.route('**/assets/maps/casa_atlas_xl/*.glb*',route=>{
   const roof=route.request().url().includes('_techo');
   return route.fulfill({path:path.join(root,'models',roof?'sd_casa_atlas_xl_v2_techo.glb':'sd_casa_atlas_xl_v2.glb'),contentType:'model/gltf-binary'});
 });
 await g.addInitScript(()=>{localStorage.setItem('sniperduel_settings',JSON.stringify({quality:'medio',v:3}));localStorage.setItem('sniperduel_diff','1')});
 await g.goto(server.url+'?vm=0');
 await g.waitForFunction(()=>window.__SD&&__SD.WORLDS&&__SD.WORLDS.casaxl);
 await g.evaluate(()=>{document.querySelector('#mapSeg [data-map=casaxl]').click();__SD.setMode('duel');__SD.setDuelLethal(false);__SD.startMatch()});
 await g.waitForFunction(()=>__SD.XL.ready&&__SD.XL.roof&&__SD.state==='playing',null,{timeout:120000});
 results.game=await g.evaluate(()=>{
   const S=__SD,N=S.WORLDS.casaxl.nav,seen=new Set();let components=0;
   for(let i=0;i<N.length;i++){if(seen.has(i))continue;components++;const q=[i];seen.add(i);while(q.length){for(const j of N[q.pop()].n){if(!seen.has(j)){seen.add(j);q.push(j)}}}}
   let triangles=0,meshes=0;for(const r of [S.XL.root,S.XL.roof])r.traverse(o=>{if(o.isMesh){meshes++;triangles+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3}});
   const B=S.BOTS.find(b=>b.alive),W=S.WORLDS.casaxl;let inside=0,outside=0,moved=0,prev=[B.g.position.x,B.g.position.z];
   for(let k=0;k<1200;k++){S.simTick(1/30);let x=B.g.position.x,z=B.g.position.z;if(W.colliders.some(c=>c.maxY>.45&&c.minY<1.8&&x>c.minX+.05&&x<c.maxX-.05&&z>c.minZ+.05&&z<c.maxZ-.05))inside++;if(x < -19.8||x>19.8||z < -15.8||z>15.8)outside++;moved+=Math.hypot(x-prev[0],z-prev[1]);prev=[x,z]}
   return{world:S.WORLD_ID,navigationComponents:components,navigationNodes:N.length,triangles,meshes,bot40s:{inside,outside,moved},testOnlyResponseSubstitution:true};
 });
 await g.screenshot({path:path.join(root,'preview','game_import.png')});
 assert.equal(results.game.navigationComponents,1);assert.equal(results.game.triangles,results.v2.triangles);assert.equal(results.game.bot40s.inside,0);assert.equal(results.game.bot40s.outside,0);assert(results.game.bot40s.moved>5);assert.equal(results.errors.length,0);
 results.passed=true;
 }finally{fs.writeFileSync(path.join(root,'browser_qa.json'),JSON.stringify(results,null,2));if(context)await context.close();server.close()}
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
