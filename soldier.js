import * as T from './three.module.min.js';
import {clamp,damp} from './physics.js';
import {angleDelta} from './navigation.js';
const ikDir=new T.Vector3(),ikBend=new T.Vector3(),ikElbow=new T.Vector3(),ikTarget=new T.Vector3(),ikUnit=new T.Vector3();
const Y=new T.Vector3(0,-1,0),v=new T.Vector3(),q=new T.Quaternion(),matrix=new T.Matrix4(),color=new T.Color();
// Eight-sided, tapered armor volume. Deliberate bevels, not voxel limbs.
function armorGeometry(){const p=[],ring=[[-.32,-.5],[.32,-.5],[.5,-.32],[.5,.32],[.32,.5],[-.32,.5],[-.5,.32],[-.5,-.32]];const tri=(a,b,c)=>p.push(...a,...b,...c);for(let i=0;i<8;i++){const j=(i+1)%8,a=[ring[i][0]*.86,.5,ring[i][1]*.86],b=[ring[j][0]*.86,.5,ring[j][1]*.86],c=[ring[i][0],-.5,ring[i][1]],d=[ring[j][0],-.5,ring[j][1]];tri(a,c,b);tri(b,c,d);tri([0,.5,0],a,b);tri([0,-.5,0],d,c);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();return g;}
const C={suit:0x354d49,plate:0xb3b3a7,joint:0x263c39,orange:0xe97b31,visor:0x78f9d7,steel:0x66756d,boot:0x324843,red:0xd85d51,blue:0x4b97d6};
function joint(parent,x=0,y=0,z=0){const o=new T.Object3D();o.position.set(x,y,z);parent.add(o);return o;}
export class SoldierBatch{
 constructor(scene,bots){this.scene=scene;this.parts=[];this.rigs=[];this.material=new T.MeshLambertMaterial({color:0xffffff,flatShading:true});this.geometry=armorGeometry();this.boxGeometry=new T.BoxGeometry(1,1,1);
  for(const b of bots)this.rigs.push(this.build(b));this.batches=[];
  for(const type of ['armor','box']){const parts=this.parts.filter(p=>p.type===type),mesh=new T.InstancedMesh(type==='armor'?this.geometry:this.boxGeometry,this.material,parts.length);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.userData.soldier=true;this.scene.add(mesh);parts.forEach((p,i)=>{p.index=i;mesh.setColorAt(i,color.setHex(p.color));});this.batches.push({mesh,parts});}
 }
 build(bot){
  const root=new T.Object3D(),pelvis=joint(root,0,.87,0),abdomen=joint(pelvis,0,.19,0),chest=joint(abdomen,0,.23,0),neck=joint(chest,0,.22,0),head=joint(neck,0,.13,0),parts=[];
  const add=(bone,size,pos,col,type='armor')=>{const o=joint(bone,...pos);o.scale.set(...size);const part={bone:o,color:col,type,bot,index:0,weapon:null};this.parts.push(part);parts.push(part);return part;};
  add(pelvis,[.35,.24,.26],[0,0,0],C.suit);add(abdomen,[.30,.26,.22],[0,0,0],C.suit);add(chest,[.49,.36,.31],[0,0,0],C.plate);add(chest,[.24,.055,.02],[.08,-.05,-.165],C.orange,'box');add(chest,[.12,.05,.025],[-.15,.06,-.17],C[bot.team],'box');
  add(neck,[.14,.16,.15],[0,0,0],C.joint);add(head,[.31,.33,.29],[0,.04,0],C.suit);add(head,[.33,.06,.02],[0,.055,-.151],C.joint,'box');add(head,[.26,.047,.018],[0,.055,-.166],C.visor,'box');for(const side of [-1,1]){add(head,[.04,.12,.09],[side*.162,.04,0],C.orange);add(pelvis,[.115,.14,.10],[side*.16,.035,-.15],C.steel);add(chest,[.065,.06,.3],[side*.2,.19,0],C.plate);}
  add(pelvis,[.36,.065,.29],[0,.035,0],C.steel,'box');add(pelvis,[.07,.06,.035],[0,.035,-.16],C.joint,'box');
  const arms=[],legs=[];
  for(const side of [-1,1]){
   const shoulder=joint(chest,side*.31,.12,0),elbow=joint(shoulder,0,-.29,0),wrist=joint(elbow,0,-.27,0),hand=joint(wrist,0,-.025,0);
   add(shoulder,[.20,.30,.22],[0,-.10,0],C.suit);add(shoulder,[.20,.052,.23],[0,-.005,0],C[bot.team]);add(elbow,[.115,.11,.12],[0,.018,0],C.joint);add(elbow,[.16,.25,.18],[0,-.13,0],C.plate);add(wrist,[.10,.07,.12],[0,0,0],C.joint);add(hand,[.11,.11,.11],[0,-.045,0],C.suit);for(const x of [-.027,.027])add(hand,[.035,.065,.038],[x,-.10,-.025],C.joint,'box');
   arms.push({side,shoulder,elbow,wrist,hand});
   const hip=joint(pelvis,side*.145,-.04,0),knee=joint(hip,0,-.41,0),ankle=joint(knee,0,-.34,0),foot=joint(ankle,0,0,-.05);
   add(hip,[.20,.37,.23],[0,-.18,0],C.suit);add(hip,[.15,.04,.015],[0,-.20,-.124],C.orange,'box');add(knee,[.135,.12,.14],[0,0,0],C.joint);add(knee,[.17,.14,.085],[0,-.025,-.09],C.steel);add(knee,[.18,.30,.20],[0,-.18,0],C.suit);add(ankle,[.15,.10,.16],[0,.02,0],C.steel);add(foot,[.19,.13,.34],[0,-.015,-.045],C.boot);legs.push({hip,knee,ankle,foot});
  }
  // Weapon rests in the hands. Each weapon has its own silhouette; animation uses the same bones.
  const gun=joint(chest,.15,-.005,-.32),guns=[];
  for(let id=0;id<3;id++){const group=joint(gun),start=parts.length;if(id===0){add(group,[.04,.05,.12],[0,0,0],C.joint);const blade=add(group,[.055,.016,.26],[.06,0,.18],C.steel);blade.bone.rotation.y=.55;}else{add(group,[.09,.11,.23],[0,0,-.06],C.joint);add(group,[id===1?.09:.12,.08,.25],[0,0,-.29],id===1?C.suit:C.steel);add(group,[.028,.03,.30],[0,.015,-.48],C.joint,'box');add(group,[.09,.12,.10],[0,-.015,.14],C.suit);if(id===1)add(group,[.06,.16,.07],[0,-.10,-.10],C.steel);else add(group,[.03,.03,.32],[0,-.04,-.35],C.suit,'box');}for(let j=start;j<parts.length;j++)parts[j].weapon=id;guns.push(group);}
  return{bot,root,pelvis,abdomen,chest,neck,head,arms,legs,gun,guns,parts,phase:0,bodyYaw:bot.yaw,pose:0,hit:0,death:0,land:0,previousGround:true};
 }
 armIK(arm,target){const shoulder=arm.shoulder.position,dx=target.x-shoulder.x,dy=target.y-shoulder.y,dz=target.z-shoulder.z,L1=.29,L2=.27,d=clamp(Math.hypot(dx,dy,dz),.09,.555),dir=ikDir.set(dx,dy,dz).normalize(),bend=ikBend.set(arm.side*.8,-.6,.1);bend.addScaledVector(dir,-bend.dot(dir)).normalize();const a=(L1*L1-L2*L2+d*d)/(2*d),h=Math.sqrt(Math.max(0,L1*L1-a*a));const elbow=ikElbow.copy(dir).multiplyScalar(a).addScaledVector(bend,h);arm.shoulder.quaternion.setFromUnitVectors(Y,ikUnit.copy(elbow).normalize());v.set(dx,dy,dz).sub(elbow).normalize().applyQuaternion(q.copy(arm.shoulder.quaternion).invert());arm.elbow.quaternion.setFromUnitVectors(Y,v);}
 update(dt,alpha,time){
  for(const r of this.rigs){const b=r.bot,p=b.body,s=p.speed,alive=b.alive;const x=p.previous.x+(p.x-p.previous.x)*alpha,z=p.previous.z+(p.z-p.previous.z)*alpha,y=p.previous.y+(p.y-p.previous.y)*alpha;
   const locomotion=s>.3?Math.atan2(-p.vx,-p.vz):b.yaw,relative=angleDelta(b.yaw,locomotion),fighting=!!b.target;
   let want=fighting?b.yaw:locomotion;if(fighting&&Math.abs(relative)>1.8)want=b.yaw;else if(fighting)want=locomotion+clamp(angleDelta(locomotion,b.yaw),-.6,.6);
   r.bodyYaw+=angleDelta(r.bodyYaw,b.bodyYaw)*(1-Math.exp(-dt*20));r.root.position.set(x,y,z);r.root.rotation.y=r.bodyYaw;
   r.pose=damp(r.pose,p.sliding?1:p.height<1.6?.62:0,13,dt);r.phase+=dt*s*2.2;const breath=Math.sin(time*2+b.id)*.006,swing=Math.min(.9,s*.075),gait=p.grounded&&!p.sliding?1:0;
   if(p.grounded&&!r.previousGround)r.land=.10;r.previousGround=p.grounded;r.land=damp(r.land,0,12,dt);r.death=damp(r.death,alive?0:1,7,dt);const crouch=clamp((1.82-p.height)/.80,0,1),slide=p.sliding?1:0,lean=slide?1.48:-crouch*1.05;r.pelvis.position.y=.87-crouch*.55-slide*.02-r.land+breath+Math.abs(Math.sin(r.phase))*.025*gait*(1-r.pose);r.pelvis.rotation.set((1-crouch)*clamp(s*.008,0,.09),0,0);
   r.root.rotation.z=r.death*1.4;r.root.position.y+=Math.sin(r.death*1.4)*.32;
   const twist=clamp(angleDelta(r.bodyYaw,b.yaw),-.95,.95);r.abdomen.position.y=.19-slide*.10;r.abdomen.rotation.order='YXZ';r.abdomen.rotation.set(lean,twist*.35,0);r.chest.rotation.y=twist*.65;r.neck.rotation.y=clamp(angleDelta(r.bodyYaw+twist,b.yaw),-.55,.55);r.head.rotation.x=-lean+b.pitch*.25;r.chest.rotation.x=-b.pitch*.25+(b.hit>0?Math.sin(b.hit*30)*.07:0);
   for(let i=0;i<2;i++){const l=r.legs[i],phase=r.phase+i*Math.PI,cycle=Math.sin(phase)*swing*gait*(1-r.pose*.8)*(fighting?Math.cos(relative):1);l.hip.rotation.set(cycle+crouch*1.29+(p.grounded?0:-.25),0,-Math.sin(phase)*swing*.7*Math.sin(relative)*gait);l.knee.rotation.x=-Math.max(0,-Math.sin(phase))*.85*gait-crouch*2.63-(p.grounded?0:.45);l.ankle.rotation.x=-(l.hip.rotation.x+l.knee.rotation.x+r.pelvis.rotation.x);l.ankle.rotation.z=-l.hip.rotation.z;if(p.sliding){l.hip.rotation.x=1.5;l.knee.rotation.x=i===0?-.2:-2.7;l.ankle.rotation.x=-(l.hip.rotation.x+l.knee.rotation.x);}}
   const reload=b.arsenal.reloadProgress,attack=b.arsenal.attack,shot=b.shotUntil>time,knife=b.arsenal.selected===0;
   r.gun.rotation.set(-lean+b.pitch*1.25+(shot?.07:0),0,reload?-.35*Math.sin(reload*Math.PI):0);const chestY=r.pelvis.position.y+r.abdomen.position.y+.23*Math.cos(lean),gunDY=p.height*.78-chestY,gunDZ=-.32;
   r.gun.position.y=gunDY*Math.cos(lean)+gunDZ*Math.sin(lean)-(reload?.07:0)-clamp((b.arsenal.switchUntil-b.arsenal.time)/.24,0,1)*.20;r.gun.position.z=-gunDY*Math.sin(lean)+gunDZ*Math.cos(lean)+(shot?.035:0);
   for(const arm of r.arms){const left=arm.side<0;let target=ikTarget.set(left?-.10:.02,-.045,left?-.09:.04).applyQuaternion(r.gun.quaternion).add(r.gun.position);if(reload&&left){target.set(-.04,-.25-Math.sin(reload*Math.PI)*.12,-.21);}if(knife){const t=attack?clamp((b.arsenal.time-attack.start)/attack.duration,0,1):0,w=Math.sin(t*Math.PI);target.set(arm.side*.25+(left?0:(attack?.combo===1?-1:1)*w*.28),-.15+(left?0:attack?.combo===2?w*.25:0),-.25-w*.18);}
    if(!fighting&&!reload&&!knife){target.y+=Math.sin(r.phase+(left?Math.PI:0))*.025;target.z+=s>9?.06:0;}this.armIK(arm,target);if(knife)arm.wrist.rotation.set(.1,0,left?-.1:.1);else arm.wrist.quaternion.copy(q.copy(arm.shoulder.quaternion).multiply(arm.elbow.quaternion).invert()).multiply(r.gun.quaternion);
   }
   if(knife){if(r.gun.parent!==r.arms[1].hand)r.arms[1].hand.add(r.gun);r.gun.position.set(0,-.06,0);r.gun.rotation.set(-1.3,0,0);}else if(r.gun.parent!==r.chest)r.chest.add(r.gun);
   r.root.updateMatrixWorld(true);
  }
  for(const batch of this.batches){for(const p of batch.parts){const b=p.bot,hidden=(!b.alive&&time-b.deathTime>2.7)||(p.weapon!==null&&p.weapon!==b.arsenal.selected);if(hidden)matrix.makeScale(0,0,0);else matrix.copy(p.bone.matrixWorld);batch.mesh.setMatrixAt(p.index,matrix);const flash=b.hit>0?2:time<b.spawnUntil?1:0;if(p.flash!==flash){p.flash=flash;color.setHex(p.color);if(flash)color.lerp(new T.Color(0xb8ffe3),flash===2?.65:.28);batch.mesh.setColorAt(p.index,color);batch.mesh.instanceColor.needsUpdate=true;}}batch.mesh.instanceMatrix.needsUpdate=true;}
 }
 dispose(){for(const b of this.batches){this.scene.remove(b.mesh);b.mesh.dispose();}this.geometry.dispose();this.boxGeometry.dispose();this.material.dispose();}
}
