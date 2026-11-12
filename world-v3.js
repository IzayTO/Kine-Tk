import * as T from './three.module.min.js';
import {V2World} from './world-v2.js';
import {SoldierBatch} from './soldier.js';
import {LootVisuals} from './loot-visuals.js';
import {clamp,damp} from './physics.js';
import {obstruction,angleDelta} from './navigation.js';
export class V3World extends V2World{
 constructor(canvas,level,params,options={}){super(canvas,level,params,options);this.match=null;this.soldiers=null;this.buildSky();this.tracePool=[];this.traceIndex=0;for(let i=0;i<14;i++){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(6),3));const line=new T.Line(g,new T.LineBasicMaterial({color:0xfbd28a,transparent:true,opacity:.65,depthWrite:false}));line.frustumCulled=false;line.visible=false;this.scene.add(line);this.tracePool.push({line,life:0});}}
 buildTargets(){this.architecture=this.shootables.slice();this.targets=[];this.targetBatches=[];this.targetPlates=[];}
 updateTargets(){}
 resetTargets(){}
 attachMatch(match){this.match=match;this.soldiers?.dispose();this.soldiers=new SoldierBatch(this.scene,match.bots);if(!this.crateMesh)this.buildCrates();if(!this.lootVisuals)this.lootVisuals=new LootVisuals(this.scene,match.supplies.drops);}
 buildSky(){const geometry=new T.SphereGeometry(145,24,12),colors=[],top=new T.Color(0x2377be),horizon=new T.Color(0xa9d4e5),p=geometry.attributes.position;for(let i=0;i<p.count;i++){const h=clamp(p.getY(i)/145,0,1),c=horizon.clone().lerp(top,Math.pow(h,.6));colors.push(c.r,c.g,c.b);}geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));this.sky=new T.Mesh(geometry,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,depthWrite:false,fog:false}));this.sky.renderOrder=-10;this.scene.add(this.sky);this.scene.fog.color.set(0xa9d4e5);this.renderer?.setClearColor(0xa9d4e5);
  const pixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const d=Math.hypot(x-31.5,y-31.5)/31.5,i=(y*64+x)*4;pixels[i]=255;pixels[i+1]=242;pixels[i+2]=204;pixels[i+3]=Math.round(Math.pow(Math.max(0,1-d),2.5)*175);}const tex=new T.DataTexture(pixels,64,64);tex.needsUpdate=true;const glow=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false,fog:false}));glow.scale.set(24,24,1);glow.renderOrder=-8;glow.position.set(-65,87,70).normalize().multiplyScalar(130);this.sky.add(glow);const sun=new T.Mesh(new T.SphereGeometry(1.65,16,10),new T.MeshBasicMaterial({color:0xfff4ce,depthWrite:false,fog:false}));sun.renderOrder=-7;sun.material.transparent=true;sun.position.copy(glow.position);this.sky.add(sun);
 }
 buildCrates(){
  // A genuinely hollow chest: floor and four thin walls, with a rear-edge lid hinge.
  const defs=[
   [[.85,.06,.65],[0,.055,0],0x3c5853,false],
   [[.06,.40,.65],[-.395,.27,0],0x3c5853,false],[[.06,.40,.65],[.395,.27,0],0x3c5853,false],
   [[.73,.40,.06],[0,.27,-.295],0x48675e,false],[[.73,.40,.06],[0,.27,.295],0x3c5853,false],
   [[.72,.012,.51],[0,.091,0],0x162e2b,false],
   [[.89,.08,.69],[0,0,-.345],0x9baa99,true],
   [[.65,.018,.22],[0,.049,-.345],0x66c6ad,true],[[.73,.012,.53],[0,-.046,-.345],0x405b51,true],
   [[.055,.40,.018],[-.28,.27,-.332],0x8d9d8b,false],[[.055,.40,.018],[.28,.27,-.332],0x8d9d8b,false],
   [[.14,.10,.025],[0,.40,-.34],0xe8a767,false],
   [[.12,.06,.08],[-.27,.49,.335],0x72897c,false],[[.12,.06,.08],[.27,.49,.335],0x72897c,false]
  ];
  const geo=new T.BoxGeometry(1,1,1),mat=new T.MeshLambertMaterial({color:0xffffff}),mesh=new T.InstancedMesh(geo,mat,this.match.crates.length*defs.length),col=new T.Color();
  mesh.frustumCulled=false;this.crateMesh=mesh;this.scene.add(mesh);this.crateParts=[];this.cratePartCount=defs.length;
  for(const c of this.match.crates){const root=new T.Object3D();root.position.set(c.x,c.y,c.z);const lid=new T.Object3D();lid.position.set(0,.52,.345);root.add(lid);
   for(const [size,pos,color,isLid]of defs){const part=new T.Object3D();part.scale.set(...size);part.position.set(...pos);(isLid?lid:root).add(part);mesh.setColorAt(this.crateParts.length,col.setHex(color));this.crateParts.push(part);}c.visual={root,lid};
  }mesh.instanceColor.needsUpdate=true;
 }

 update(dt,p,input,alpha,arsenal){this.visualAlpha=alpha;super.update(dt,p,input,alpha,arsenal);this.camera.updateMatrixWorld(true);if(this.preferences){const m=this.models[1];m.squareSight.visible=this.preferences.sightShape!=='circle';m.circleSight.visible=this.preferences.sightShape==='circle';}this.lootVisuals?.update(this.camera,this.match.time);this.sky?.position.copy(this.camera.position);if(this.match){this.soldiers?.update(dt,alpha,this.match.time);for(const c of this.match.crates){c.lid=c.available?0:1;c.visual.lid.rotation.x=c.lid*1.88;c.visual.root.updateMatrixWorld(true);}this.crateParts?.forEach((p,i)=>this.crateMesh.setMatrixAt(i,p.matrixWorld));if(this.crateMesh)this.crateMesh.instanceMatrix.needsUpdate=true;}for(const t of this.tracePool){t.life-=dt;t.line.visible=t.life>0;}}
 fire(event,origin=null,direction=null){if(!this.match)return[];this.camera.getWorldDirection(this.dir);this.shotTime=this.time;this.recoil=Math.min(2,this.recoil+(event.weapon==='shotgun'?1.8:.8)*this.params.recoil);return this.match.weaponEvent(this.match.player,event,origin||this.camera.position,direction||this.dir);}
 melee(){return this.match?.weaponEvent(this.match.player,{type:'melee',weapon:'knife'})||[];}
 showTrace(e){const t=this.tracePool[this.traceIndex++%this.tracePool.length],a=t.line.geometry.attributes.position;t.life=.055;t.line.visible=true;a.setXYZ(0,e.from.x,e.from.y,e.from.z);a.setXYZ(1,e.to.x,e.to.y,e.to.z);a.needsUpdate=true;const impact=this.impacts[this.impactIndex++%this.impacts.length];impact.life=.15;impact.mesh.visible=true;impact.mesh.position.set(e.to.x,e.to.y,e.to.z);impact.mesh.material.color.set(0xf6c98b);}
 assistTarget(yaw,pitch,prefs){if(!this.match)return null;let best=null,bestAngle=prefs.assistRadius*Math.PI/180;for(const b of this.match.bots){if(!b.alive||!this.match.enemy(this.match.player,b)||this.match.time<b.spawnUntil)continue;const p=b.body,t={x:p.x,y:p.y+p.height*.70,z:p.z},o=this.camera.position,dx=t.x-o.x,dy=t.y-o.y,dz=t.z-o.z,d=Math.hypot(dx,dy,dz);if(d>prefs.assistRange)continue;const y=Math.atan2(-dx,-dz),pitchTo=Math.atan2(dy,Math.hypot(dx,dz)),a=Math.hypot(angleDelta(yaw,y),pitchTo-pitch);if(a<bestAngle&&obstruction(this.match.world.colliders,o,t)>.999){best={id:b.id,yaw:y,pitch:pitchTo,distance:d,visible:true};bestAngle=a;}}return best;}
 confirmAssist(candidate){if(!candidate||!this.match)return null;const b=this.match.bots.find(b=>b.id===candidate.id);if(!b?.alive||!this.match.enemy(this.match.player,b)||this.match.time<b.spawnUntil)return null;const p=b.body,t={x:p.x,y:p.y+p.height*.70,z:p.z},o=this.camera.position,dx=t.x-o.x,dy=t.y-o.y,dz=t.z-o.z;return obstruction(this.match.world.colliders,o,t)>.999?{id:b.id,yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz)),distance:Math.hypot(dx,dy,dz),visible:true}:null;}

}
