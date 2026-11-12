import * as T from './three.module.min.js';
import {clamp} from './physics.js';
import {obstruction,randomStream} from './navigation.js';

// Authored mounting points: canopy, perimeter, workshop beams, mezzanine,
// control hall, bridges and service duct. Fixtures never occupy walking space.
const ceiling=(x,y,z,r=13)=>({x,y,z,r,wall:false,n:[0,-1,0]});
const wall=(x,y,z,n,r=15)=>({x,y,z,r,wall:true,n});
export const LAMPS=Object.freeze([
 ceiling(-4,3.87,42),ceiling(4,3.87,42),
 wall(-26,4.7,47.87,[0,0,-1]),wall(26,4.7,47.87,[0,0,-1]),
 wall(47.87,5,-30,[-1,0,0]),wall(47.87,5,-8,[-1,0,0]),
 wall(47.87,5,16,[-1,0,0]),wall(47.87,5,37,[-1,0,0]),
 wall(-47.87,5,-30,[1,0,0]),wall(-47.87,5,23,[1,0,0]),
 wall(-28,6,-47.87,[0,0,1]),wall(30,6,-47.87,[0,0,1]),
 ceiling(-25.5,6.40,-14.5),ceiling(-25.5,6.40,3.5),
 ceiling(-35.5,6.40,-5.5),ceiling(-35.5,6.40,12.5),
 ceiling(-35.5,2.72,-11,9),ceiling(-35.5,2.72,-2,9),
 ceiling(-9,5.91,-33),ceiling(4,5.91,-29),ceiling(15,5.91,-36),
 ceiling(-3.5,2.70,-8),ceiling(15.5,2.73,-8),
 wall(8,6.3,3.8,[0,0,1],16),wall(4,7.0,-42.05,[0,0,1],14),
 ceiling(25,1.095,20,7),ceiling(32,1.095,20,7)
]);

// One static colour bake. Subdivision is restricted to large architectural faces;
// detailed trim keeps its original triangle count. No runtime shadow maps.
export function bakeNightGeometry(meshes,solids,lamps=LAMPS){
 const positions=[],colors=[],cache=new Map(),warm=new T.Color(0xffce89);
 const matrix=new T.Matrix4(),instance=new T.Matrix4(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 const lightPoints=lamps.map(l=>({x:l.x+l.n[0]*.18,y:l.y+l.n[1]*.18,z:l.z+l.n[2]*.18,r:l.r}));
 let rays=0;
 function irradiance(v,n){
  const key=[v.x,v.y,v.z,n.x,n.y,n.z].map(x=>Math.round(x*100)).join(',');
  let light=cache.get(key);if(light!==undefined)return light;
  light=0;const point={x:v.x+n.x*.045,y:v.y+n.y*.045,z:v.z+n.z*.045};
  for(const l of lightPoints){const dx=l.x-point.x,dy=l.y-point.y,dz=l.z-point.z,d=Math.hypot(dx,dy,dz);if(d>=l.r||d<.01)continue;
   const facing=(dx*n.x+dy*n.y+dz*n.z)/d;if(facing<=0)continue;rays++;
   if(obstruction(solids,point,l)<.998)continue;
   light+=Math.pow(1-d/l.r,2)*2.35*(.25+.75*facing);
  }cache.set(key,light);return light;
 }
 function triangle(a,b,c,base,depth=0){
  const ab=a.distanceToSquared(b),bc=b.distanceToSquared(c),ca=c.distanceToSquared(a);
  const normal=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a));
  const area=normal.length()*.5;
  if(depth<13&&area>3&&Math.max(ab,bc,ca)>9){
   if(ab>=bc&&ab>=ca){const m=a.clone().add(b).multiplyScalar(.5);triangle(a,m,c,base,depth+1);triangle(m,b,c,base,depth+1);}
   else if(bc>=ca){const m=b.clone().add(c).multiplyScalar(.5);triangle(a,b,m,base,depth+1);triangle(a,m,c,base,depth+1);}
   else{const m=c.clone().add(a).multiplyScalar(.5);triangle(a,b,m,base,depth+1);triangle(m,b,c,base,depth+1);}return;
  }
  normal.normalize();const ambient=.27+.11*Math.max(0,normal.y)+.045*Math.max(0,-normal.x);
  for(const v of [a,b,c]){positions.push(v.x,v.y,v.z);const glow=irradiance(v,normal);colors.push(base.r*(ambient+warm.r*glow),base.g*(ambient+warm.g*glow),base.b*(ambient+warm.b*glow));}
 }
 for(const mesh of meshes){mesh.updateMatrixWorld(true);const p=mesh.geometry.attributes.position,idx=mesh.geometry.index,count=idx?idx.count:p.count;
  for(let k=0;k<(mesh.isInstancedMesh?mesh.count:1);k++){
   if(mesh.isInstancedMesh){mesh.getMatrixAt(k,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance);}else matrix.copy(mesh.matrixWorld);
   for(let j=0;j<count;j+=3){a.fromBufferAttribute(p,idx?idx.getX(j):j).applyMatrix4(matrix);b.fromBufferAttribute(p,idx?idx.getX(j+1):j+1).applyMatrix4(matrix);c.fromBufferAttribute(p,idx?idx.getX(j+2):j+2).applyMatrix4(matrix);triangle(a,b,c,mesh.material.color);}
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();geometry.userData={triangles:positions.length/9,lightSamples:cache.size,occlusionChecks:rays};return geometry;
}

export class NightEnvironment{
 constructor(view){this.view=view;this.night=false;this.nightMesh=null;this.timer=0;this.pool=[];
  this.daySky=view.sky.geometry.attributes.color.array.slice();this.dayFog=view.scene.fog.color.clone();this.dayBodies=[...view.sky.children];
  this.savedLights=[...view.scene.children,...view.gunScene.children].filter(o=>o.isLight).map(light=>({light,color:light.color.clone(),ground:light.groundColor?.clone(),intensity:light.intensity}));
  this.buildFixtures();this.buildNightSky();
 }
 buildFixtures(){const scene=this.view.scene,geo=new T.BoxGeometry(1,1,1),shell=new T.MeshLambertMaterial({color:0x304341});this.emitMaterial=new T.MeshBasicMaterial({color:0x69736b});
  const housing=new T.InstancedMesh(geo,shell,LAMPS.length),emitters=new T.InstancedMesh(geo,this.emitMaterial,LAMPS.length),temp=new T.Object3D();
  LAMPS.forEach((l,i)=>{temp.position.set(l.x,l.y,l.z);temp.rotation.set(0,Math.atan2(l.n[0],l.n[2]),0);temp.scale.set(1.05,l.wall?.30:.07,l.wall?.16:.30);temp.updateMatrix();housing.setMatrixAt(i,temp.matrix);
   temp.position.add(new T.Vector3(...l.n).multiplyScalar(l.wall?.09:.04));temp.scale.set(.87,l.wall?.19:.015,l.wall?.025:.21);temp.updateMatrix();emitters.setMatrixAt(i,temp.matrix);});
  housing.computeBoundingSphere();emitters.computeBoundingSphere();scene.add(housing,emitters);
  // Only two nearby warm lights shade moving bodies/loot. Architecture is baked.
  // They have no shadow maps and are disabled entirely in daylight.
  for(let i=0;i<2;i++){const light=new T.PointLight(0xffd496,0,16,1.5);light.castShadow=false;light.visible=false;scene.add(light);this.pool.push({light,index:-1,next:-1});}
 }
 buildNightSky(){this.starsAndMoon=new T.Group();this.starsAndMoon.visible=false;this.view.sky.add(this.starsAndMoon);
  const rng=randomStream(0x9a17),positions=[],colors=[],moonDir=new T.Vector3(-.55,.62,-.56).normalize();
  while(positions.length<330*3){const y=.06+rng()*.93,angle=rng()*Math.PI*2,r=Math.sqrt(1-y*y),v=new T.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);if(v.dot(moonDir)>.997)continue;
   positions.push(v.x*142,v.y*142,v.z*142);const brightness=.30+rng()*.60;colors.push(brightness,brightness*.97,brightness*.91);}
  const stars=new T.BufferGeometry();stars.setAttribute('position',new T.Float32BufferAttribute(positions,3));stars.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const points=new T.Points(stars,new T.PointsMaterial({size:.48,vertexColors:true,transparent:true,opacity:.78,depthWrite:false,fog:false}));points.renderOrder=-9;this.starsAndMoon.add(points);
  // A proper crescent silhouette, not a bright full disc under an opaque halo.
  const vertices=[],radius=4.2,steps=48;
  for(let i=0;i<steps;i++){const y0=-1+2*i/steps,y1=-1+2*(i+1)/steps,x0=Math.sqrt(Math.max(0,1-y0*y0)),x1=Math.sqrt(Math.max(0,1-y1*y1));
   const a=[x0*.46*radius,y0*radius,0],b=[x0*radius,y0*radius,0],c=[x1*radius,y1*radius,0],d=[x1*.46*radius,y1*radius,0];vertices.push(...a,...b,...c,...a,...c,...d);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeBoundingSphere();
  this.moon=new T.Mesh(geo,new T.MeshBasicMaterial({color:0xf2edce,side:T.DoubleSide,transparent:true,depthWrite:false,fog:false}));this.moon.position.copy(moonDir).multiplyScalar(130);this.moon.lookAt(0,0,0);this.moon.rotateZ(-.20);this.moon.renderOrder=-7;this.starsAndMoon.add(this.moon);
 }
 setMode(mode){const night=mode==='night';if(night===this.night)return;this.night=night;const v=this.view;
  if(night&&!this.nightMesh){const geo=bakeNightGeometry(v.architecture,v.level.solids);this.nightMesh=new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true}));v.scene.add(this.nightMesh);}
  for(const mesh of v.architecture)mesh.visible=!night;if(this.nightMesh)this.nightMesh.visible=night;
  const attribute=v.sky.geometry.attributes.color,pos=v.sky.geometry.attributes.position;
  if(night){const horizon=new T.Color(0x29394e),top=new T.Color(0x060e21),color=new T.Color();for(let i=0;i<pos.count;i++){color.copy(horizon).lerp(top,Math.pow(clamp(pos.getY(i)/145,0,1),.55));attribute.setXYZ(i,color.r,color.g,color.b);}v.scene.fog.color.copy(horizon);}
  else{attribute.array.set(this.daySky);v.scene.fog.color.copy(this.dayFog);}attribute.needsUpdate=true;v.renderer?.setClearColor(v.scene.fog.color);
  this.dayBodies.forEach(o=>o.visible=!night);this.starsAndMoon.visible=night;this.emitMaterial.color.set(night?0xffd394:0x69736b);
  for(const item of this.savedLights){const {light}=item;light.color.copy(night?new T.Color(0xffdeb1):item.color);if(light.groundColor)light.groundColor.copy(night?new T.Color(0x4a4541):item.ground);light.intensity=night?(light.isHemisphereLight?1.2:.65):item.intensity;}
  for(const slot of this.pool){slot.light.visible=night;slot.light.intensity=0;slot.index=slot.next=-1;}this.timer=0;
 }
 update(dt,player){if(!this.night)return;this.timer-=dt;
  if(this.timer<=0){this.timer=.25;let first=-1,second=-1,d1=Infinity,d2=Infinity;
   for(let i=0;i<LAMPS.length;i++){const l=LAMPS[i],d=Math.hypot(player.x-l.x,player.y+1-l.y,player.z-l.z);if(d<d1){d2=d1;second=first;d1=d;first=i;}else if(d<d2){d2=d;second=i;}}
   const selected=[first,second];for(const slot of this.pool)if(selected.includes(slot.next))selected.splice(selected.indexOf(slot.next),1);else slot.next=-1;for(const slot of this.pool)if(slot.next<0)slot.next=selected.shift()??-1;
  }
  for(const slot of this.pool){const light=slot.light;if(slot.index!==slot.next){light.intensity=Math.max(0,light.intensity-dt*45);if(light.intensity<.01){slot.index=slot.next;if(slot.index>=0){const l=LAMPS[slot.index];light.position.set(l.x+l.n[0]*.18,l.y+l.n[1]*.18,l.z+l.n[2]*.18);light.distance=l.r;}}}
   else if(slot.index>=0)light.intensity=Math.min(14,light.intensity+dt*35);
  }
 }
}
