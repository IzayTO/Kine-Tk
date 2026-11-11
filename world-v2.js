import * as T from './three.module.min.js';
import {WorldView} from './render.js';
import {clamp,horizontalToVertical,CollisionWorld} from './physics.js';
import {buildModels,aimTransform,segment} from './weapon-models.js';
import {damageFor,knifePose} from './combat.js';
const zero=new T.Vector2(),up=new T.Vector3(0,1,0),down=new T.Vector3(0,-1,0);
export class V2World extends WorldView{
 constructor(canvas,level,params,options={}){
  super(canvas,level,params,options);this.collisionWorld=new CollisionWorld(level.solids);
  this.hitsBuffer=[];this.rng=9271;this.pingPosition=null;this.pingAge=0;this.targetClock=0;
  this.dir=new T.Vector3();this.right=new T.Vector3();this.vertical=new T.Vector3();this.scratch=new T.Vector3();this.shotDir=new T.Vector3();
  this.pingMesh=new T.Mesh(new T.OctahedronGeometry(.16,0),new T.MeshBasicMaterial({color:0xffcd83,depthTest:true}));this.pingMesh.visible=false;this.scene.add(this.pingMesh);
 }
 buildTargets(){
  this.architecture=this.shootables.slice();this.scene.updateMatrixWorld(true);
  this.targets=this.level.targets.map(t=>{const support=this.ray(new T.Vector3(t.x,t.y+.2,t.z),down,this.architecture,4);const y=support?.point.y??t.y-1.65;return{id:t.id,x:t.x,z:t.z,y,angle:t.angle,hp:100,alive:true,revive:0,flash:0,chest:new T.Vector3(t.x,y+1.41,t.z)};});
  // Four batches, with real head / torso / limb intersections. Dead instances leave the raycast volume.
  const defs=[['head',new T.IcosahedronGeometry(.20,0),0xe8be63,[[0,1.64,0,1,1,1]]],['torso',new T.BoxGeometry(1,1,1),0xc5b67d,[[0,1.14,0,.54,.66,.31]]],['limb',new T.BoxGeometry(1,1,1),0x668d8d,[[-.36,1.13,0,.15,.64,.19],[.36,1.13,0,.15,.64,.19]]],['limb',new T.BoxGeometry(1,1,1),0x47656a,[[-.17,.40,0,.18,.80,.24],[.17,.40,0,.18,.80,.24]]]];
  this.targetBatches=[];const o=new T.Object3D();
  for(const [zone,geometry,color,parts]of defs){const mesh=new T.InstancedMesh(geometry,new T.MeshLambertMaterial({color:0xffffff,flatShading:true}),this.targets.length*parts.length);mesh.userData.targetBatch=true;mesh.userData.zone=zone;mesh.userData.targets=[];const matrices=[];
   this.targets.forEach(t=>parts.forEach(([x,y,z,w,h,d])=>{const i=matrices.length;o.position.set(t.x+x*Math.cos(t.angle)+z*Math.sin(t.angle),t.y+y,t.z-x*Math.sin(t.angle)+z*Math.cos(t.angle));o.rotation.set(0,t.angle,0);o.scale.set(w,h,d);o.updateMatrix();matrices.push(o.matrix.clone());mesh.setMatrixAt(i,o.matrix);mesh.setColorAt(i,new T.Color(color));mesh.userData.targets.push(t);}));
   mesh.computeBoundingSphere();this.scene.add(mesh);this.shootables.push(mesh);this.targetBatches.push({mesh,matrices,color:new T.Color(color)});
  }
  this.targetPlates=[];
 }
 buildWeapon(){
  super.buildWeapon();const old=this.weapon;old.removeFromParent();old.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.material)o.material.dispose();}});
  this.models=buildModels();for(const m of this.models){this.rig.add(m.root);m.root.visible=false;if(m.rear)m.ads=aimTransform(m);}
  this.selectedModel=1;this.weapon=this.models[1].root;this.weapon.visible=true;this.flash=this.models[1].flash;this.muzzle=this.models[1].muzzle;this.emptyFlash={visible:false};
 }
 resize(w,h,force=false){if(this.renderer)return super.resize(w,h,force);this.width=w;this.height=h;this.camera.aspect=this.gunCamera.aspect=w/h;this.camera.fov=horizontalToVertical(this.hFov,w/h);this.gunCamera.fov=horizontalToVertical(86,w/h);this.camera.updateProjectionMatrix();this.gunCamera.updateProjectionMatrix();}
 update(dt,p,input,alpha,arsenal){
  this.arsenal=arsenal||this.arsenal;const a=this.arsenal,selected=a?.selected??1;
  if(selected!==this.selectedModel){this.models[this.selectedModel].root.visible=false;this.selectedModel=selected;const m=this.models[selected];this.weapon=m.root;this.weapon.visible=true;this.flash=m.flash||this.emptyFlash;this.muzzle=m.muzzle;}
  const allowADS=selected!==0&&!a?.reload&&(!a||a.time>=a.switchUntil);
  super.update(dt,p,{...input,aim:allowADS&&input.aim},alpha);
  const m=this.models[selected];this.weapon.position.set(0,0,0);this.weapon.rotation.set(0,0,0);
  for(const arm of this.arms)arm.visible=selected!==0;
  if(m.ads){
   // Solve optical alignment from physical sight anchors. ADS removes all lateral/rotational sway.
   this.rig.position.lerp(m.ads.position,this.aim);this.rig.quaternion.slerp(m.ads.rotation,this.aim);this.rig.position.z+=this.recoil*.025*this.aim;
  }
  const switchDrop=a?clamp((a.switchUntil-a.time)/.24,0,1):0;this.rig.position.y-=Math.sin(switchDrop*Math.PI/2)*.22;
  // Clear per-weapon hand offsets before layering the current action.
  this.arms[1].position.y=0;this.arms[1].rotation.x=0;
  if(selected===1){const q=a?.reload?a.reloadProgress:0;
   if(a?.reload){this.rig.position.y+=this.poseSprint*.055;this.rig.rotation.x+=this.poseSprint*.17;this.rig.rotation.y-=this.poseSprint*.28;this.rig.rotation.z-=this.poseSprint*.29;}
   m.mag.position.y=-.13-Math.sin(q*Math.PI)*.22;m.mag.rotation.z=-Math.sin(q*Math.PI)*.13;if(q){this.rig.rotation.z-=Math.sin(q*Math.PI)*.26;this.arms[1].position.y=-Math.sin(q*Math.PI)*.15;}else this.arms[1].position.y=0;}
  if(selected===2){const elapsed=a?a.time-a.lastShot:100,duration=a?.shotgunMode==='tactical'?.27:.51,start=a?.shotgunMode==='tactical'?.10:.15,pump=elapsed>start&&elapsed<start+duration?Math.sin((elapsed-start)/duration*Math.PI):0;m.pump.position.z=-.47+pump*.13;this.arms[1].position.z=pump*.13;
   const q=a?.reload?a.reloadProgress:0;m.shell.visible=!!a?.reload;m.shell.position.y=-.21+q*.12;this.arms[1].rotation.x=-Math.sin(q*Math.PI)*.3;this.rig.rotation.z-=Math.sin(q*Math.PI)*.13;
  }else this.arms[1].position.z=0;
  if(selected===0){const attack=a?.attack,t=attack?clamp((a.time-attack.start)/attack.duration,0,1):0,pose=attack?knifePose(attack.combo,t):[0,0,0];
   this.rig.position.set(.17+Math.sin(this.phase*1.1)*.018*this.bob*this.params.cameraMotion,-.12+Math.cos(this.phase*2)*.014*this.bob*this.params.cameraMotion-this.poseSlide*.045+this.landing*.3-this.jumpKick*.02,-.72+this.recoil*.015);this.rig.rotation.set(.10*this.poseSlide+clamp(p.vy,-10,10)*.003*this.params.cameraMotion,.08*this.poseSprint,.11*this.poseSprint);
   m.wrist.position.set(pose[0],pose[1],pose[2]);m.wrist.rotation.set(attack?Math.sin(t*Math.PI)*.8:0,attack?(attack.combo===1?-1:1)*Math.sin(t*Math.PI)*1.0:0,.25+pose[0]*1.8);
   const hand=m.wrist.position,elbow=new T.Vector3(.16+pose[0]*.3,-.16+pose[1]*.4,.22+pose[2]*.2),shoulder=new T.Vector3(.30,-.29,.50);segment(m.fore,hand,elbow);segment(m.upper,elbow,shoulder);
  }
  this.rig.updateMatrixWorld(true);this.updateTargets(dt);if(this.pingPosition){this.pingAge+=dt;this.pingMesh.scale.setScalar(1+Math.max(0,1-this.pingAge*3)*.8);}
 }
 ray(origin,direction,objects=this.shootables,max=150){this.raycast.set(origin,direction);this.raycast.far=max;this.hitsBuffer??=[];this.hitsBuffer.length=0;this.raycast.intersectObjects(objects,false,this.hitsBuffer);return this.hitsBuffer[0]||null;}
 targetOf(hit){return hit?.object.userData.targetBatch?hit.object.userData.targets[hit.instanceId]:null;}
 updateTargets(dt){this.targetClock+=dt;let changed=false;for(const t of this.targets){if(!t.alive&&this.time>=t.revive){t.alive=true;t.hp=100;changed=true;}if(t.flash>0){t.flash=Math.max(0,t.flash-dt);changed=true;}}if(changed)this.refreshTargets();}
 refreshTargets(){const hidden=new T.Matrix4().makeTranslation(0,-1000,0),hitColor=new T.Color(0x81ffd8);for(const b of this.targetBatches){b.mesh.userData.targets.forEach((t,i)=>{b.mesh.setMatrixAt(i,t.alive?b.matrices[i]:hidden);b.mesh.setColorAt(i,t.flash>0?hitColor:b.color);});b.mesh.instanceMatrix.needsUpdate=true;b.mesh.instanceColor.needsUpdate=true;}}
 resetTargets(){for(const t of this.targets){t.hp=100;t.alive=true;t.flash=0;}this.refreshTargets();}
 damage(hit,weapon){const target=this.targetOf(hit);if(!target?.alive)return null;const damage=damageFor(weapon,hit.object.userData.zone,hit.distance);target.hp=Math.max(0,target.hp-damage);target.flash=.13;if(!target.hp){target.alive=false;target.revive=this.time+4;}return{target:target.id,zone:hit.object.userData.zone,damage,killed:!target.alive,distance:hit.distance};}
 effect(hit){if(!hit)return;const e=this.impacts[this.impactIndex++%this.impacts.length];e.life=.24;e.mesh.visible=true;e.mesh.position.copy(hit.point);e.mesh.material.color.set(this.targetOf(hit)?0x76ffd5:0xffd38a);}
 random(){this.rng=(Math.imul(1664525,this.rng)+1013904223)>>>0;return this.rng/4294967296;}
 fire(event){
  this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);this.camera.getWorldDirection(this.dir);this.right.set(1,0,0).applyQuaternion(this.camera.quaternion);this.vertical.set(0,1,0).applyQuaternion(this.camera.quaternion);
  this.shotTime=this.time;this.recoil=Math.min(2,this.recoil+(event.weapon==='shotgun'?1.8:.8)*this.params.recoil);const results=[];let last=null;
  for(let i=0;i<event.pellets;i++){const radius=Math.sqrt(this.random())*Math.tan(event.spread),angle=this.random()*Math.PI*2;this.shotDir.copy(this.dir).addScaledVector(this.right,Math.cos(angle)*radius).addScaledVector(this.vertical,Math.sin(angle)*radius).normalize();const hit=this.ray(this.camera.position,this.shotDir);if(hit){this.effect(hit);const result=this.damage(hit,event.weapon);if(result)results.push(result);last=hit.point.clone();}}
  if(results.length)this.refreshTargets();const end=last||this.camera.position.clone().addScaledVector(this.dir,100),start=this.scratch.copy(this.camera.position).addScaledVector(this.dir,.55).addScaledVector(this.right,.13).addScaledVector(this.vertical,-.14);
  const attr=this.tracer.geometry.attributes.position;attr.setXYZ(0,start.x,start.y,start.z);attr.setXYZ(1,end.x,end.y,end.z);attr.needsUpdate=true;this.tracer.geometry.computeBoundingSphere();this.flash.visible=true;return results;
 }
 melee(){
  this.scene.updateMatrixWorld(true);this.camera.getWorldDirection(this.dir);let best=null,bestDist=Infinity;
  for(const target of this.targets){if(!target.alive)continue;this.scratch.copy(target.chest).sub(this.camera.position);const distance=this.scratch.length();if(distance>2.2||distance>=bestDist||this.scratch.normalize().dot(this.dir)<Math.cos(.48))continue;
   const hit=this.ray(this.camera.position,this.scratch,this.shootables,2.2);if(this.targetOf(hit)===target){best=hit;bestDist=distance;}}
  if(!best)return[];this.effect(best);const hit=this.damage(best,'knife');this.refreshTargets();return hit?[hit]:[];
 }
 assistTarget(yaw,pitch,prefs){
  this.scene.updateMatrixWorld(true);let best=null,bestAngle=prefs.assistRadius*Math.PI/180;
  for(const t of this.targets){if(!t.alive)continue;const dx=t.chest.x-this.camera.position.x,dy=t.chest.y-this.camera.position.y,dz=t.chest.z-this.camera.position.z,d=Math.hypot(dx,dy,dz);if(d>prefs.assistRange)continue;
   const y=Math.atan2(-dx,-dz),p=Math.atan2(dy,Math.hypot(dx,dz)),angle=Math.hypot(Math.atan2(Math.sin(y-yaw),Math.cos(y-yaw)),p-pitch);if(angle>=bestAngle)continue;
   this.scratch.set(dx,dy,dz).normalize();const hit=this.ray(this.camera.position,this.scratch,this.shootables,d+.2);if(this.targetOf(hit)!==t)continue;bestAngle=angle;best={yaw:y,pitch:p,distance:d,visible:true,id:t.id};
  }return best;
 }
 confirmAssist(candidate){
  if(!candidate)return null;const target=this.targets.find(t=>t.id===candidate.id);if(!target?.alive)return null;
  const direction=this.scratch.copy(target.chest).sub(this.camera.position),distance=direction.length();direction.normalize();
  const hit=this.ray(this.camera.position,direction,this.shootables,distance+.2);return this.targetOf(hit)===target?{...candidate,distance,visible:true}:null;
 }
 placePing(){
  this.scene.updateMatrixWorld(true);this.camera.getWorldDirection(this.dir);let hit=this.ray(this.camera.position,this.dir,this.architecture,150),point=hit?.point.clone();
  if(!point||Math.abs(point.x)>47.9||Math.abs(point.z)>47.9){point=null;const horizontal=Math.hypot(this.dir.x,this.dir.z)||1;
   for(const distance of [24,16,8,3]){this.scratch.set(clamp(this.camera.position.x+this.dir.x/horizontal*distance,-47,47),30,clamp(this.camera.position.z+this.dir.z/horizontal*distance,-47,47));hit=this.ray(this.scratch,down,this.architecture,60);if(hit&&hit.face?.normal.y>.5&&this.collisionWorld.clear(hit.point.x,hit.point.y+.02,hit.point.z,1.82)){point=hit.point.clone();break;}}
  }if(!point)return false;this.pingPosition=point;this.pingAge=0;this.pingMesh.position.copy(point);this.pingMesh.visible=true;return true;
 }
 pingScreen(){if(!this.pingPosition)return null;const d=this.camera.position.distanceTo(this.pingPosition);this.scratch.copy(this.pingPosition).project(this.camera);return{x:(this.scratch.x*.5+.5)*this.width,y:(-.5*this.scratch.y+.5)*this.height,distance:d,visible:this.scratch.z<1&&this.scratch.z>-1&&Math.abs(this.scratch.x)<.98&&Math.abs(this.scratch.y)<.95};}
 render(){if(this.renderer)super.render();}
}
