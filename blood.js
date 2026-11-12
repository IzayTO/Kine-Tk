import * as T from './three.module.min.js';
import {circleContact,surfaceY,clamp} from './physics.js';
export const BLOOD_CAPACITY=192;
export const bloodOpacity=age=>age<0||age>=10?0:age<=7?1:1-(age-7)/3;
function stream(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
// Independent random stream: cosmetic trails never change combat or AI randomness.
export class BloodTrail{
 constructor(world){this.world=world;this.slots=Array.from({length:BLOOD_CAPACITY},()=>({born:-100,serial:0}));this.reset();}
 reset(){this.random=stream(0xb100d);this.next=0;this.serial=0;this.walkers=new Map();for(const s of this.slots){s.born=-100;s.serial=++this.serial;}}
 surface(x,y,z,down=.4){let best=null;for(const c of this.world.query(x,z,.01)){if(!circleContact(c,x,z,.001)?.inside)continue;const h=surfaceY(c,x,z);if(h<=y+.13&&h>=y-down&&(!best||h>best.y))best={c,y:h};}return best;}
 stamp(actor,time,impact=false){const p=actor.body,r=this.random,severity=clamp((100-actor.health)/100,0,1),x=p.x+(r()-.5)*.16,z=p.z+(r()-.5)*.16,floor=this.surface(x,p.y,z,impact?3:.4);if(!floor)return false;
  const s=this.slots[this.next];if(time-s.born<10)return false;this.next=(this.next+1)%this.slots.length;
  Object.assign(s,{born:time,serial:++this.serial,x,z,floor:floor.c,angle:r()*Math.PI*2,size:(impact?.21+.16*severity:.105+.14*severity)*(.72+r()*.65),stretch:.8+r()*.7,variant:Math.floor(r()*8),tone:.76+r()*.24});return true;
 }
 wound(actor,healthLost,time){if(healthLost<=0)return;const prev=this.walkers.get(actor.id);if(!prev||time-prev.lastHit>=.065){this.stamp(actor,time,true);this.walkers.set(actor.id,{x:actor.body.x,z:actor.body.z,distance:0,next:.4+this.random(),lastHit:time});}}
 step(actors,time){for(const a of actors){const p=a.body;let s=this.walkers.get(a.id);
   if(!a.alive||a.health>=100){this.walkers.delete(a.id);continue;}
   if(!s){s={x:p.x,z:p.z,distance:0,next:.6+this.random(),lastHit:-100};this.walkers.set(a.id,s);}
   const moved=Math.hypot(p.x-s.x,p.z-s.z);s.x=p.x;s.z=p.z;if(!p.grounded||moved>1||moved<1e-6)continue;
   s.distance+=moved;if(s.distance<s.next)continue;s.distance=0;const severity=(100-a.health)/100,r=this.random;
   s.next=(1.2-.75*severity)*(.65+r()*1.15);if(r()<.28+.60*severity)this.stamp(a,time);
  }}
}
// Eight irregular silhouettes: central splash, asymmetric lobes and scattered small drops.
// No particle motion, images, external textures or custom shaders.
function patterns(){return Array.from({length:8},(_,index)=>{const r=stream(901+index*331),tri=[];
  const blob=(x,z,radius,n)=>{const ring=Array.from({length:n},(_,i)=>{const angle=i/n*Math.PI*2,k=radius*(.7+r()*.4);return[x+Math.cos(angle)*k,z+Math.sin(angle)*k];});for(let i=0;i<n;i++)tri.push([[x,z],ring[i],ring[(i+1)%n]]);};
  blob(0,0,.70+r()*.3,10);for(let i=0;i<3+index%4;i++){const angle=r()*Math.PI*2,dist=1+r()*.75;blob(Math.cos(angle)*dist,Math.sin(angle)*dist,.06+r()*.17,5);}return tri;});}
const PATTERNS=patterns(),TRIANGLES=40,VERTICES=TRIANGLES*3;
export class BloodMarks{
 constructor(scene){this.scene=scene;this.geometry=new T.BufferGeometry();this.positions=new Float32Array(BLOOD_CAPACITY*VERTICES*3);this.colors=new Float32Array(BLOOD_CAPACITY*VERTICES*4);this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));this.geometry.setAttribute('color',new T.BufferAttribute(this.colors,4).setUsage(T.DynamicDrawUsage));
  this.material=new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,side:T.DoubleSide});this.mesh=new T.Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;this.mesh.renderOrder=2;scene.add(this.mesh);this.seen=new Int32Array(BLOOD_CAPACITY).fill(-1);this.counts=new Uint16Array(BLOOD_CAPACITY);this.alpha=new Float64Array(BLOOD_CAPACITY);this.base=new T.Color(0x70121d);this.source=null;
 }
 attach(source){this.source=source;this.seen.fill(-1);this.colors.fill(0);this.counts.fill(0);this.alpha.fill(0);this.geometry.attributes.color.needsUpdate=true;}
 write(slot,index){const start=index*VERTICES,cos=Math.cos(slot.angle),sin=Math.sin(slot.angle);let count=0;
  if(slot.floor)for(const triangle of PATTERNS[slot.variant]){const pts=triangle.map(([u,v])=>{const dx=u*slot.size,dz=v*slot.size*slot.stretch;return{x:slot.x+dx*cos-dz*sin,z:slot.z+dx*sin+dz*cos};});
   // Do not stretch a decal over a platform edge or bridge a stair gap.
   if(pts.some(p=>!circleContact(slot.floor,p.x,p.z,.001)?.inside))continue;
   for(const p of pts){const j=(start+count)*3,k=(start+count)*4;this.positions[j]=p.x;this.positions[j+1]=surfaceY(slot.floor,p.x,p.z)+.027;this.positions[j+2]=p.z;this.colors[k]=this.base.r*slot.tone;this.colors[k+1]=this.base.g*slot.tone;this.colors[k+2]=this.base.b*slot.tone;count++;}
  }
  for(let i=count;i<VERTICES;i++){const j=(start+i)*3;this.positions[j]=this.positions[j+1]=this.positions[j+2]=0;this.colors[(start+i)*4+3]=0;}
  this.counts[index]=count;this.alpha[index]=-1;
 }
 update(time){if(!this.source)return;let positionChanged=false,colorChanged=false,visible=false;for(let i=0;i<BLOOD_CAPACITY;i++){const s=this.source.slots[i],fresh=this.seen[i]!==s.serial;if(fresh){this.seen[i]=s.serial;this.write(s,i);positionChanged=true;}const alpha=bloodOpacity(time-s.born)*.86;
   if(alpha!==this.alpha[i]){this.alpha[i]=alpha;for(let j=0;j<this.counts[i];j++)this.colors[(i*VERTICES+j)*4+3]=alpha;colorChanged=true;}
   visible ||= alpha>0&&this.counts[i]>0;
  }this.mesh.visible=visible;if(positionChanged)this.geometry.attributes.position.needsUpdate=true;if(colorChanged)this.geometry.attributes.color.needsUpdate=true;}
}
