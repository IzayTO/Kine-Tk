import {clamp} from './physics.js';
import {angleDelta,obstruction} from './navigation.js';
const DEG=Math.PI/180;
export class AimSupport{
 constructor(match,preferences){this.match=match;this.preferences=preferences;this.reset();}
 reset(){this.target=null;this.scanAt=0;this.manualAt=-100;this.manualX=0;this.manualY=0;this.fireId=null;this.fireSince=0;}
 manual(dx,dy){if(Math.hypot(dx,dy)>1e-7){this.manualAt=this.match.time;this.manualX=dx;this.manualY=dy;}}
 targetInfo(actor,origin,yaw,pitch){const m=this.match,p=this.preferences;if(!actor?.alive||!m.enemy(m.player,actor)||m.time<actor.spawnUntil)return null;const b=actor.body,point={x:b.x,y:b.y+b.height*.70,z:b.z},x=point.x-origin.x,y=point.y-origin.y,z=point.z-origin.z,d=Math.hypot(x,y,z);if(d>p.assistRange)return null;const ty=Math.atan2(-x,-z),tp=Math.atan2(y,Math.hypot(x,z)),error=Math.hypot(angleDelta(yaw,ty),tp-pitch);if(error>p.assistRadius*DEG||obstruction(m.world.colliders,origin,point)<.999)return null;return{id:actor.id,yaw:ty,pitch:tp,distance:d,visible:true,error};}
 track(dt,origin,yaw,pitch,ads,allowed){const m=this.match,p=this.preferences;if(!ads||!allowed||!p.assist||!m.player.alive||m.player.consuming||m.time-this.manualAt>.28){this.target=null;return[yaw,pitch];}
  let info=this.targetInfo(this.target,origin,yaw,pitch);
  if(!info&&m.time>=this.scanAt){this.scanAt=m.time+.075;let best=null;for(const b of m.bots){const t=this.targetInfo(b,origin,yaw,pitch);if(t&&(!best||t.error<best.error)){best=t;this.target=b;}}info=best;}
  if(!info)return[yaw,pitch];const ex=angleDelta(yaw,info.yaw),ey=info.pitch-pitch,weight=Math.pow(1-info.error/(p.assistRadius*DEG),.6),strength=p.assistStrength;
  const gain=(1-Math.exp(-12*strength*weight*dt)),limit=(24+50*strength)*DEG*dt;
  // Deliberately pulling away wins over assistance; no autonomous tracking at rest.
  const x=ex*this.manualX<0&&Math.abs(this.manualX)>.003?0:clamp(ex*gain,-limit,limit);
  const y=ey*this.manualY<0&&Math.abs(this.manualY)>.003?0:clamp(ey*gain,-limit,limit);
  return[yaw+x,clamp(pitch+y,-1.48,1.48)];
 }
 autoTarget(origin,direction,ads){const m=this.match,a=m.player;if(!this.preferences.autoFire||!ads||!a.alive||a.arsenal.selected===0||a.arsenal.reload||a.consuming||a.opening||a.arsenal.time<a.arsenal.switchUntil){this.fireId=null;return null;}
  const hit=m.lineTarget(a,origin,direction,Math.min(60,this.preferences.assistRange+15)),b=hit?.actor;
  if(!b||!m.enemy(a,b)||!b.alive||m.time<b.spawnUntil){this.fireId=null;return null;}
  if(this.fireId!==b.id){this.fireId=b.id;this.fireSince=m.time;return null;}
  return m.time-this.fireSince>=.075?b:null;
 }
}
