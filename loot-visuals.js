import * as T from './three.module.min.js';
import {clamp} from './physics.js';
const kinds=['rifle','shotgun','bandage','mini'];
// Four tiny generated icons, shaded like miniature objects; no downloaded textures.
function texture(kind){if(typeof document==='undefined')return null;const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const c=canvas.getContext('2d');if(!c)return null;
 const poly=(points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
 c.fillStyle='#132e3333';c.beginPath();c.ellipse(48,81,30,7,0,0,Math.PI*2);c.fill();
 if(kind==='rifle'||kind==='shotgun'){const shell=kind==='shotgun';poly([[22,39],[62,26],[76,38],[37,52]],shell?'#d7ae83':'#c8d4ab');poly([[22,39],[37,52],[37,77],[22,64]],shell?'#87574f':'#45685c');poly([[37,52],[76,38],[76,64],[37,77]],shell?'#b65e50':'#719481');for(let i=0;i<3;i++){const x=32+i*12,y=32-i*3;poly([[x,y],[x+7,y-3],[x+7,y-16],[x+3,y-21],[x,y-16]],'#e5c988');poly([[x+5,y-3],[x+7,y-3],[x+7,y-16],[x+5,y-19]],'#a98b53');}}
 else if(kind==='bandage'){poly([[21,39],[60,27],[76,39],[36,53]],'#eaf0d8');poly([[21,39],[36,53],[36,76],[21,63]],'#809c8c');poly([[36,53],[76,39],[76,62],[36,76]],'#becfb4');poly([[40,51],[52,47],[52,70],[40,74]],'#5dc09a');poly([[36,60],[68,50],[68,57],[36,67]],'#5dc09a');c.strokeStyle='#edf5e1';c.lineWidth=3;c.beginPath();c.ellipse(29,48,5,9,-.5,0,6.28);c.stroke();}
 else{poly([[37,20],[54,16],[62,23],[45,28]],'#b7e7ee');poly([[37,20],[45,28],[45,36],[37,28]],'#6b9baa');poly([[45,28],[62,23],[62,31],[45,36]],'#83bec9');poly([[37,30],[44,34],[62,29],[69,41],[68,71],[46,80],[28,68],[28,43]],'#62beec');poly([[46,43],[68,36],[68,71],[46,80]],'#348dc9');poly([[31,44],[40,48],[40,69],[31,63]],'#b1efff');poly([[43,52],[61,46],[61,58],[43,64]],'#dcf5ec');}
 const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;return tex;
}
export class LootVisuals{
 constructor(scene,drops){this.drops=drops;this.meshes=[];this.obj=new T.Object3D();const geometry=new T.PlaneGeometry(1,1);for(const kind of kinds){const map=texture(kind),mesh=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({map,color:map?0xffffff:0x8cdcc6,transparent:true,alphaTest:.02,depthWrite:false,fog:true}),drops.filter(d=>d.kind===kind).length);mesh.frustumCulled=false;mesh.count=0;scene.add(mesh);this.meshes.push(mesh);}this.geometry=geometry;}
 update(camera,time){for(let k=0;k<4;k++){const mesh=this.meshes[k];let i=0;for(const d of this.drops){if(d.kind!==kinds[k])continue;const fly=d.collector&&time-d.flyStart>=0&&time-d.flyStart<.32;if(!d.active&&!fly)continue;const o=this.obj;o.quaternion.copy(camera.quaternion);let x=d.x,y=d.y+Math.sin((time-d.born)*2+d.id)*.055,z=d.z,scale=.65;
  if(fly){const t=clamp((time-d.flyStart)/.32,0,1),q=t*t*(3-2*t),a=d.collector.body;x+=(a.x-x)*q;y+=(a.y+Math.min(1.15,a.height*.65)-y)*q;z+=(a.z-z)*q;scale*=1-q*.88;}
  o.position.set(x,y,z);o.scale.setScalar(scale);o.updateMatrix();mesh.setMatrixAt(i++,o.matrix);
 }mesh.count=i;if(i)mesh.instanceMatrix.needsUpdate=true;}}
}
