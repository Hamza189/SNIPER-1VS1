/* CARGA PROGRESIVA (03-11-2026, docs/CARGA.md): how long the MENÚ 2 takes to show your operator and your weapon on a
   phone-like CPU (×4, iPhone size, the PC's GPU), FSB and ÚLTIMA chosen: first the light versions (operator 1K, arma_tp),
   then the full 4K ones. Two visits.  node tools/carga-operador.js */
'use strict';
const { chromium } = require('playwright');const ss = require('./static-server.js');
(async()=>{const srv=await ss.start();const b=await chromium.launch({args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:932,height:430},deviceScaleFactor:2,hasTouch:true,isMobile:true});
await ctx.addInitScript(()=>{localStorage.setItem('sniperduel_settings',JSON.stringify({quality:'alto',v:3}));localStorage.setItem('sniperduel_skin','"fsb"');localStorage.setItem('sniperduel_wsRifle','"ultima"');});
for(const visit of [1,2]){const p=await ctx.newPage();const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
const errs=[];p.on('pageerror',e=>errs.push(e.message));const t0=Date.now();await p.goto(srv.url+'?pueblo=3');
const at=async(fn,ms)=>{try{await p.waitForFunction(fn,null,{timeout:ms,polling:100});return Date.now()-t0;}catch(e){return null;}};
await p.waitForFunction(()=>window.__SD&&__SD.M2&&__SD.M2.R,null,{timeout:120000});await p.evaluate(()=>__SD.m2Tab('armas'));
const r={};
r.operadorVisible=await at(()=>__SD.M2.opShown===true,120000);
r.operador1K=await p.evaluate(()=>!!__SD.M2.R.v2prev);
r.armaVisible=await at(()=>!!__SD.M2.item,120000);
r.operador4K=await at(()=>__SD.M2.R.v2&&!__SD.M2.R.v2prev,180000);
r.arma4K=await at(()=>__SD.WS_ST.rifle.cur==='ultima'&&__SD.WS_ST.rifle.objs.length>0,240000);
console.log('visita',visit,JSON.stringify(r),'errores',errs.length,errs[0]||'');await p.close();}
await b.close();srv.close();})();
