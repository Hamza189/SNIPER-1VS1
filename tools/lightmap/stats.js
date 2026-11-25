'use strict';
const fs=require('fs'),path=require('path');
const W=path.join(__dirname,'.work','pueblo'),J=require(W+'.json'),B=fs.readFileSync(W+'.bin');
const f32=(o,n)=>new Float32Array(B.buffer.slice(B.byteOffset+o,B.byteOffset+o+n*4)),u32=(o,n)=>new Uint32Array(B.buffer.slice(B.byteOffset+o,B.byteOffset+o+n*4));
let tot=0;
for(const m of J.meshes){const P=f32(m.pos,m.verts*3),I=u32(m.ix,m.idx);let a=0;
  for(let t=0;t<I.length;t+=3){const i=I[t]*3,j=I[t+1]*3,k=I[t+2]*3;const ux=P[j]-P[i],uy=P[j+1]-P[i+1],uz=P[j+2]-P[i+2],vx=P[k]-P[i],vy=P[k+1]-P[i+1],vz=P[k+2]-P[i+2];
    a+=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2;}
  m.area=a;if(/^(p3_|casas_)/.test(m.name))tot+=a;}
J.meshes.filter(m=>/^(p3_|casas_)/.test(m.name)).sort((a,b)=>b.area-a.area).forEach(m=>console.log(m.name.padEnd(30),m.verts,Math.round(m.area)));
console.log('area receptores m2',Math.round(tot));
