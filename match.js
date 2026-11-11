// Local authoritative simulation. No network, DOM or render timing dependency.
import {Player,DEFAULTS,clamp,BODY} from './physics.js';
import {Arsenal,damageFor} from './combat.js';
import {Navigation,obstruction,angleDelta,distance,randomStream} from './navigation.js';
export const PROFILES=Object.freeze([
 {name:'Agresivo',range:12,advance:.85,flank:.48,slide:.75,retreat:.32},
 {name:'Táctico',range:23,advance:.45,flank:.80,slide:.38,retreat:.65},
 {name:'Ágil',range:16,advance:.65,flank:.75,slide:.95,retreat:.42},
 {name:'Defensivo',range:25,advance:.25,flank:.25,slide:.24,retreat:.76},
 {name:'Equilibrado',range:18,advance:.55,flank:.50,slide:.55,retreat:.5}
]);
export const DIFFICULTY=Object.freeze({easy:{reaction:.68,error:.065,tactics:.5,turn:2.4},normal:{reaction:.38,error:.037,tactics:.8,turn:3.6},hard:{reaction:.23,error:.023,tactics:1.1,turn:4.4}});
export const MATCH_DEFAULTS=Object.freeze({mode:'training',bots:4,difficulty:'normal',team:'blue',minutes:5,limit:30,quality:'adaptive',crateSeconds:36});
const copyPos=p=>({x:p.x,y:p.y,z:p.z});
const chest=a=>({x:a.body.x,y:a.body.y+Math.min(1.38,a.body.height*.78),z:a.body.z});
const eye=a=>({x:a.body.x,y:a.body.y+a.body.height-.16,z:a.body.z});
const direction=(yaw,pitch)=>({x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)});
function sphereDistance(o,d,c,r){const x=o.x-c.x,y=o.y-c.y,z=o.z-c.z,b=x*d.x+y*d.y+z*d.z,h=b*b-(x*x+y*y+z*z-r*r);if(h<0)return Infinity;const t=-b-Math.sqrt(h);return t>=0?t:(-b+Math.sqrt(h)>=0?0:Infinity);}
export class Match{
 constructor(world,player,arsenal,params=DEFAULTS){this.world=world;this.params=params;this.nav=new Navigation(world);this.player={id:0,name:'TÚ',body:player,arsenal,team:'blue',human:true};this.actors=[this.player];this.bots=[];this.events=[];this.sounds=[];this.time=0;this.running=false;this.ended=false;this.config={...MATCH_DEFAULTS};this.rng=randomStream(91223);this.crates=[];this.routeBudget=0;this.metrics={decisions:0,los:0,shots:0,replans:0,jumps:0,slides:0};this.qualityScale=1;this.setupCrates();this.initialize(this.player);}
 initialize(a){a.health=100;a.shield=100;a.alive=true;a.kills=0;a.deaths=0;a.spawnUntil=0;a.deadUntil=0;a.lastDamage=-100;a.hit=0;a.yaw=0;a.pitch=0;a.shotUntil=0;}
 enemy(a,b){return a!==b&&(this.config.mode==='ffa'||a.team!==b.team);}
 visible(a,b,range=52,fov=true){if(!b.alive||!this.enemy(a,b)||this.time<b.spawnUntil)return false;const pa=eye(a),pb=chest(b),d=distance(pa,pb);if(d>range||Math.abs(pa.y-pb.y)>14)return false;const yaw=Math.atan2(-(pb.x-pa.x),-(pb.z-pa.z));if(fov&&Math.abs(angleDelta(a.yaw,yaw))>1.12)return false;this.metrics.los++;return obstruction(this.world.colliders,pa,pb)>.999;}
 setupCrates(){const spots=[[-9,0,37],[-37,0,20],[-26,0,-10],[3,0,-39],[30,0,29],[44,0,-10],[15,2.4,4],[-34,3.2,-14]];this.crates=spots.map((v,id)=>{const n=this.nav.nearest({x:v[0],y:v[1],z:v[2]});return{id,x:n.x,y:n.y,z:n.z,available:true,ready:0,lid:0,rifle:0,shotgun:0};});for(const c of this.crates)this.stock(c);}
 stock(c){const type=this.rng();c.rifle=type<.78?(this.rng()<.5?60:100):0;c.shotgun=type>.48?(this.rng()<.5?14:21):0;c.available=true;c.ready=0;}
 spawn(a){
  const anchors=a.team==='red'?[[0,-36],[38,-18],[-34,-25],[14,-18]]:[[-5,37],[34,36],[-33,22],[44,10]];
  if(this.config.mode==='ffa')anchors.push([0,24],[0,-35],[-30,1],[41,0]);
  let best=null,score=-Infinity;for(const [x,z]of anchors)for(const off of [0,-3,3]){const n=this.nav.nearest({x:x+off,y:0,z});if(n.low||n.y>.5||n.edges.length<3)continue;let s=40;const pos={x:n.x,y:n.y+1.4,z:n.z};for(const b of this.actors){if(b===a||!b.alive)continue;const d=distance(n,b.body);if(this.enemy(a,b)){s=Math.min(s,d);if(d<35&&obstruction(this.world.colliders,eye(b),pos)>.99)s-=12;if(b.shotUntil>this.time)s-=Math.max(0,12-d);}else s-=d<2?30:0;}s+=this.rng()*1.5;if(s>score){score=s;best=n;}}
  const n=best||this.nav.nearest({x:0,y:0,z:39});a.body.reset(n);a.health=100;a.shield=100;a.alive=true;a.spawnUntil=this.time+2.2;a.arsenal.refill();a.yaw=a.team==='blue'?0:Math.PI;a.pitch=0;a.bodyYaw=a.yaw;a.gunYaw=a.yaw;a.lastDamage=-100;
  if(!a.human){a.path=[];a.pathAt=0;a.goal=null;a.routePending=false;a.target=null;a.seenId=null;a.memory=null;a.recognizedAt=Infinity;a.state='EXPLORAR';a.nextDecision=this.time+a.id*.013;a.nextTactic=this.time+.2;a.nextRoute=0;a.positionPlanUntil=0;a.stuck=0;a.lastProgress=copyPos(a.body);a.input.x=a.input.z=0;}
  this.events.push({type:'spawn',actor:a.id,position:copyPos(a.body)});
 }
 start(config={}){
  this.config={...MATCH_DEFAULTS,...config};this.config.bots=clamp(Math.round(this.config.bots),1,20);if(!DIFFICULTY[this.config.difficulty])this.config.difficulty='normal';if(!['training','ffa','tdm'].includes(this.config.mode))this.config.mode='training';
  this.time=0;this.events.length=0;this.sounds.length=0;this.running=true;this.ended=false;this.score={red:0,blue:0};this.result=null;this.rng=randomStream(9021);this.actors=[this.player];this.bots=[];this.initialize(this.player);this.player.team=this.config.team==='red'?'red':'blue';
  for(let i=0;i<this.config.bots;i++){const rng=randomStream(7723+i*1297),profile=PROFILES[i%5],b={id:i+1,name:profile.name+' '+String(i+1).padStart(2,'0'),profile,rng,body:new Player(this.world,{...this.params,autoSprint:false}),arsenal:new Arsenal(),human:false,team:this.config.mode==='training'?(this.player.team==='blue'?'red':'blue'):(i%2?this.player.team:(this.player.team==='blue'?'red':'blue')),traits:{reaction:.85+rng()*.3,range:.82+rng()*.36,aim:.8+rng()*.4,bias:rng()*6.28,bravery:.85+rng()*.3},input:{x:0,z:0,yaw:0,sprint:false,jump:false,slide:false,crouch:false},path:[],pathAt:0,goal:null,state:'EXPLORAR',aimYaw:0,aimPitch:0,yawRate:0,nextManeuver:0,strafeSign:rng()<.5?-1:1,stepDistance:0};this.initialize(b);this.bots.push(b);this.actors.push(b);}
  for(const a of this.actors)this.spawn(a);for(const c of this.crates)this.stock(c);this.metrics={decisions:0,los:0,shots:0,replans:0,jumps:0,slides:0};
 }
 hear(source,radius,kind){const p=source.body;this.sounds.push({id:source.id,team:source.team,x:p.x,y:p.y,z:p.z,radius,kind,expires:this.time+.7,stamp:this.time});if(this.sounds.length>40)this.sounds.shift();}
 decision(b){
  this.metrics.decisions++;const diff=DIFFICULTY[this.config.difficulty],p=b.body;
  let candidate=null,best=Infinity;for(const a of this.actors){if(!a.alive||!this.enemy(b,a))continue;const d=distance(p,a.body);if(d>=best)continue;if(this.visible(b,a,52,true)){candidate=a;best=d;}}
  if(candidate){if(b.seenId!==candidate.id){b.seenId=candidate.id;b.recognizedAt=this.time+diff.reaction*b.traits.reaction;}b.target=candidate;b.memory={...copyPos(candidate.body),id:candidate.id,expires:this.time+5.5};b.lastSeen=this.time;}
  else{b.target=null;b.seenId=null;b.recognizedAt=Infinity;if(b.memory&&this.time>b.memory.expires)b.memory=null;}
  if(!b.target){for(let i=this.sounds.length-1;i>=0;i--){const s=this.sounds[i];if(s.id===b.id||s.expires<this.time||(this.config.mode!=='ffa'&&s.team===b.team)||s.stamp<=(b.lastHeard??-1))continue;const d=distance(p,s);if(d<s.radius){const error=2+d*.08,angle=b.rng()*6.28;b.memory={x:s.x+Math.cos(angle)*error,y:s.y,z:s.z+Math.sin(angle)*error,expires:this.time+3.5,id:null};b.lastHeard=s.stamp;break;}}}
  // Nearby allies can suggest a coarse last-seen sector, never reveal live hidden coordinates.
  if(this.config.mode==='tdm'&&!b.memory&&this.config.difficulty!=='easy')for(const ally of this.bots){if(ally!==b&&ally.team===b.team&&ally.memory&&distance(p,ally.body)<12){b.memory={...ally.memory,x:ally.memory.x+1.5,z:ally.memory.z-1.5,expires:Math.min(ally.memory.expires,this.time+2)};break;}}
  if(b.positionPlanUntil>this.time&&b.goal&&(distance(p,b.goal)>1.4||Math.abs(p.y-b.goal.y)>.5)&&b.health+b.shield>65)return;
  if(this.time<b.nextTactic)return;b.nextTactic=this.time+.65+b.rng()*.55;
  if(b.arsenal.selected!==0&&b.arsenal.ammo<b.arsenal.weapon.capacity*.38&&!b.arsenal.reload&&(!b.target||distance(p,b.target.body)>15)){if(b.arsenal.requestReload())this.events.push({type:'reload',actor:b.id,position:copyPos(p)});}
  const ammo=b.arsenal.slots,low=ammo[1].reserve<35&&ammo[1].ammo<12;
  if(low){let supply=null,d=Infinity;for(const c of this.crates)if(c.available&&c.rifle&&distance(c,p)<d){d=distance(c,p);supply=c;}if(supply){b.state='REABASTECER';this.setGoal(b,supply);return;}}
  if(b.target&&this.time>=b.recognizedAt){const target=b.target,dist=distance(p,target.body),weak=b.health+b.shield<65,desired=b.profile.range*b.traits.range;
   const slot=dist<2.6?0:dist<11&&ammo[2].ammo+ammo[2].reserve>0?2:ammo[1].ammo+ammo[1].reserve>0?1:ammo[2].ammo+ammo[2].reserve>0?2:0;if(b.arsenal.select(slot))this.events.push({type:'switch',actor:b.id,position:copyPos(p)});
   if(!weak&&!b.arsenal.reload&&(b.profile.name==='Táctico'||b.profile.name==='Ágil')&&b.rng()<.32*diff.tactics){const high=this.nav.overwatch(p,b.memory,desired);if(high){b.state='ALTURA';b.positionPlanUntil=this.time+14;this.setGoal(b,high);return;}}
   if((weak||b.arsenal.reload||b.profile.name==='Táctico'||b.profile.name==='Defensivo')&&b.rng()<b.profile.retreat*diff.tactics+.15){const cover=this.nav.coverFrom(p,b.memory,desired);if(cover){b.state=weak?'RETIRARSE':'COBERTURA';b.cover=cover;this.setGoal(b,cover);return;}}
   const bearing=Math.atan2(p.z-target.body.z,p.x-target.body.x),flank=b.rng()<b.profile.flank*diff.tactics;
   const advance=dist>desired+5||target.health+target.shield<60||target.arsenal.reload;
   const radius=advance?Math.max(2.1,desired*(.9-.35*b.profile.advance*b.traits.bravery)):weak?desired+7:desired;
   const angle=bearing+(flank?b.strafeSign*(.4+b.rng()*.4):b.strafeSign*.18);
   const guess={x:target.body.x+Math.cos(angle)*radius,y:target.body.y,z:target.body.z+Math.sin(angle)*radius};
   b.state=flank?'FLANQUEAR':advance?'PRESIONAR':'DESPLAZAMIENTO';this.setGoal(b,this.nav.nearest(guess,this.nav.nearest(p).component));if(b.rng()<.2)b.strafeSign*=-1;
  }else if(b.memory){b.state='INVESTIGAR';this.setGoal(b,this.nav.nearest(b.memory,this.nav.nearest(p).component));}
  else if(!b.goal||distance(p,b.goal)<2||!b.path.length){b.state='EXPLORAR';this.setGoal(b,this.nav.destination(p,b.rng));}
  if(b.arsenal.selected!==0&&b.arsenal.ammo<b.arsenal.weapon.capacity*.38&&!b.arsenal.reload&&(!b.target||distance(p,b.target.body)>15||b.state==='COBERTURA')){if(b.arsenal.requestReload())this.events.push({type:'reload',actor:b.id,weapon:b.arsenal.weapon.id,position:copyPos(p)});}
 }
 setGoal(b,goal){if(!goal)return;if(b.goal&&distance(b.goal,goal)<2&&b.path.length)return;b.goal=copyPos(goal);b.routePending=true;}
 route(b){if(!b.goal){b.routePending=false;return;}if(!b.routePending||this.routeBudget<1||this.time<b.nextRoute)return;this.routeBudget--;b.nextRoute=this.time+.65;b.routePending=false;b.path=this.nav.path(b.body,b.goal,b.traits.bias);b.pathAt=0;if(!b.path.length){b.goal=null;b.input.x=b.input.z=0;}this.metrics.replans++;}
 steer(b,dt){
  const p=b.body,cmd=b.input;cmd.jump=cmd.slide=false;cmd.crouch=false;cmd.sprint=false;
  let node=b.path[b.pathAt];while(node&&distance(p,node)<.7&&Math.abs(p.y-node.y)<.55){b.pathAt++;node=b.path[b.pathAt];}
  let dx=0,dz=0;
  if(node){
   // Safe look-ahead follows corners without arriving, stopping, then rotating on the spot.
   let aim=node;if(node.kind!=='jump')for(let k=b.pathAt+1;k<Math.min(b.pathAt+4,b.path.length);k++){const n=b.path[k];if(n.kind==='jump'||distance(p,n)>4.5||Math.abs(n.y-p.y)>.65)break;if(this.nav.walkable(p,n)>=0)aim=n;else break;}
   dx=aim.x-p.x;dz=aim.z-p.z;const len=Math.hypot(dx,dz);if(len){dx/=len;dz/=len;}
   const under=!this.world.clear(p.x+dx*.8,p.y,p.z+dz*.8,BODY.stand,.35)&&this.world.clear(p.x+dx*.8,p.y,p.z+dz*.8,BODY.crouch,.35);
   cmd.crouch=node.low||under;
   const fighting=!!b.target&&this.time>=b.recognizedAt;cmd.sprint=!cmd.crouch&&(!fighting||b.state==='RETIRARSE'||b.state==='FLANQUEAR'||b.state==='PRESIONAR');
   if(p.grounded&&this.time>b.nextManeuver){
    if(node.kind==='jump'&&distance(p,node)<6.5&&p.speed>6){cmd.jump=true;cmd.sprint=true;b.nextManeuver=this.time+1.4;this.metrics.jumps++;}
    else if(p.speed>8&&((under&&distance(p,node)>1)||(b.state==='RETIRARSE'&&distance(p,b.goal)<7)||(b.state==='FLANQUEAR'&&b.profile.slide>.6&&b.rng()<.035))){cmd.slide=true;b.nextManeuver=this.time+4+b.rng()*3;this.metrics.slides++;}
   }
   if(p.sliding&&!cmd.crouch&&b.profile.name==='Ágil'&&p.slideTime>.28&&p.slideTime<.31&&b.target&&this.world.clear(p.x,p.y+.8,p.z,BODY.stand)){cmd.jump=true;this.metrics.jumps++;}
   // Human-scale separation, applied to steering rather than teleported positions.
   for(const other of this.bots){if(other===b||!other.alive||Math.abs(p.y-other.body.y)>1)continue;const x=p.x-other.body.x,z=p.z-other.body.z,d2=x*x+z*z;if(d2<1.8*1.8&&d2>.001){const force=(1.8-Math.sqrt(d2))*.7/d2;dx+=x*force;dz+=z*force;}}
   const l=Math.hypot(dx,dz);if(l>0){dx/=l;dz/=l;}
   // A predictive clearance guard brakes before a wall or an unlinked edge.
   if(node.kind!=='jump'&&p.grounded){const s=this.world.support(p.x+dx*.6,p.y,p.z+dz*.6,.35,.6);if(!s||!this.world.clear(p.x+dx*.5,s.y+.31,p.z+dz*.5,(cmd.crouch?BODY.crouch:BODY.stand)-.31,.31)){dx*=.25;dz*=.25;b.routePending=true;}}
  }
  cmd.x=dx;cmd.z=dz;cmd.yaw=0;
  b.stuck=(Math.hypot(dx,dz)>.2&&distance(p,b.lastProgress)<.22)?b.stuck+dt:0;
  if(distance(p,b.lastProgress)>.8){b.lastProgress=copyPos(p);b.stuck=0;}
  if(b.stuck>1.35){b.stuck=0;b.lastProgress=copyPos(p);b.goal=null;b.path=[];b.positionPlanUntil=0;b.routePending=false;b.nextTactic=0;b.memory=null;b.state='RECUPERAR';this.setGoal(b,this.nav.destination(p,b.rng,5));}
 }
 aim(b,dt){const diff=DIFFICULTY[this.config.difficulty],p=b.body;let targetYaw=Math.hypot(b.input.x,b.input.z)>.1?Math.atan2(-b.input.x,-b.input.z):b.yaw,targetPitch=0;
  if(b.target&&this.time>=b.recognizedAt){const a=eye(b),t=chest(b.target),d=distance(a,t);const error=diff.error*b.traits.aim*(1+p.speed*.045+(p.grounded?0:.7));targetYaw=Math.atan2(-(t.x-a.x),-(t.z-a.z))+Math.sin(this.time*2.5+b.traits.bias)*error;targetPitch=Math.atan2(t.y-a.y,d)+Math.sin(this.time*1.9+b.id)*error*.65;}
  const error=angleDelta(b.yaw,targetYaw),wanted=clamp(error*5,-diff.turn,diff.turn);b.yawRate+=clamp(wanted-b.yawRate,-dt*14,dt*14);b.yaw+=b.yawRate*dt;b.pitch+=clamp(targetPitch-b.pitch,-dt*2.5,dt*2.5);
  const travel=p.speed>.3?Math.atan2(-p.vx,-p.vz):b.yaw,relative=angleDelta(b.yaw,travel),want=b.target?(Math.abs(relative)>1.8?b.yaw:travel+clamp(angleDelta(travel,b.yaw),-.6,.6)):travel;b.bodyYaw+=clamp(angleDelta(b.bodyYaw,want),-dt*4.5,dt*4.5);b.gunYaw=b.bodyYaw+clamp(angleDelta(b.bodyYaw,b.yaw),-.95,.95);
 }
 step(dt){if(!this.running||this.ended)return;this.time+=dt;this.routeBudget=Math.min(2,this.routeBudget+dt*12);this.sounds=this.sounds.filter(s=>s.expires>this.time);
  for(const a of this.actors){a.hit=Math.max(0,a.hit-dt);if(!a.alive&&this.time>=a.deadUntil)this.spawn(a);}
  for(const b of this.bots){if(!b.alive)continue;
   if(this.time>=b.nextDecision){this.decision(b);const far=distance(b.body,this.player.body)>38&&!b.target;b.nextDecision=this.time+(far?.25:.11)*(this.config.quality==='low'?1.5:this.config.quality==='high'?.8:this.qualityScale);}
   this.route(b);if(this.time>=(b.nextSteer||0)){this.steer(b,1/20);b.nextSteer=this.time+.05;}this.aim(b,dt);const wasSlide=b.body.sliding;b.body.step(dt,b.input);b.input.jump=b.input.slide=false;
   if(b.body.jumpEvent)this.events.push({type:'jump',actor:b.id,position:copyPos(b.body)});
   if(b.body.landEvent&&b.body.landImpact>4){this.hear(b,15,'land');this.events.push({type:'land',actor:b.id,position:copyPos(b.body)});}
   if(!wasSlide&&b.body.sliding)this.events.push({type:'slide',actor:b.id,position:copyPos(b.body)});
   b.stepDistance+=b.body.speed*dt;if(b.stepDistance>2.7&&b.body.grounded&&!b.body.sliding){b.stepDistance=0;this.events.push({type:b.body.speed>9?'sprint':'step',actor:b.id,position:copyPos(b.body)});if(b.body.speed>9)this.hear(b,13,'sprint');}
   let fire=false;if(b.target&&this.time>=b.recognizedAt&&this.time>=b.spawnUntil){const pos=eye(b),t=chest(b.target),d=distance(pos,t),yaw=Math.atan2(-(t.x-pos.x),-(t.z-pos.z));const angle=Math.abs(angleDelta(b.gunYaw,yaw));
    if(b.arsenal.selected===0)fire=d<=2.7;else fire=angle<.16&&this.visible(b,b.target,55,false)&&this.lineTarget(b,pos,direction(b.gunYaw,b.pitch),60)?.actor?.team!==b.team;
    if(this.config.mode==='ffa'&&angle<.16&&b.arsenal.selected!==0)fire=this.visible(b,b.target,55,false);
    // Bursts and deliberate pauses preserve readable combat, especially at range.
    fire=fire&&(b.arsenal.selected!==1||((this.time+b.traits.bias)%(d>22?1.1:.8)<(d>22?.46:.58)));
   }
   b.arsenal.step(dt,{fire},{speed:b.body.speed,grounded:b.body.grounded,aim:!!b.target},e=>this.weaponEvent(b,e));
  }
  for(const c of this.crates){if(!c.available&&this.time>=c.ready)this.stock(c);if(!c.available)continue;for(const a of this.actors){if(!a.alive||Math.abs(a.body.y-c.y)>.8||distance(a.body,c)>1.55)continue;if(a.arsenal.supply(c.rifle,c.shotgun)>0){c.available=false;c.ready=this.time+clamp(this.config.crateSeconds,20,90);this.events.push({type:'crate',actor:a.id,position:copyPos(c)});this.events.push({type:'supply',actor:a.id,position:copyPos(c)});break;}}}
  if(this.config.mode!=='training'&&(this.time>=this.config.minutes*60||(this.config.mode==='tdm'?Math.max(this.score.red,this.score.blue):Math.max(...this.actors.map(a=>a.kills)))>=this.config.limit))this.finish();
 }
 weaponEvent(a,event,origin=null,dir=null){if(!a.alive||!this.running||this.ended)return[];const d=dir||direction(a.human?a.yaw:a.gunYaw,a.pitch),base=chest(a),o=origin||(a.human?eye(a):{x:base.x+d.x*.85+Math.cos(a.gunYaw)*.15,y:base.y+d.y*.85,z:base.z+d.z*.85-Math.sin(a.gunYaw)*.15});const muzzleBlocked=!origin&&!a.human&&obstruction(this.world.colliders,base,o)<.999;const result=[];
  if(event.type==='shot'){a.spawnUntil=Math.min(a.spawnUntil,this.time);this.metrics.shots++;a.shotUntil=this.time+.1;this.hear(a,event.weapon==='shotgun'?52:46,'shot');
   for(let i=0;i<(event.pellets||1);i++){const r=Math.sqrt(this.rng())*Math.tan(event.spread||0),t=this.rng()*Math.PI*2;const yaw=Math.atan2(-d.x,-d.z),pitch=Math.asin(clamp(d.y,-1,1)),ray=direction(yaw+Math.cos(t)*r,pitch+Math.sin(t)*r),hit=muzzleBlocked?this.lineTarget(a,base,ray,1):this.lineTarget(a,o,ray,110);
    if(!muzzleBlocked&&hit?.actor&&this.enemy(a,hit.actor)){const info=this.damage(hit.actor,damageFor(event.weapon,hit.zone,hit.distance),a);if(info)result.push({...info,zone:hit.zone});}
    if(i===0)this.events.push({type:'trace',actor:a.id,from:copyPos(muzzleBlocked?base:o),to:hit?.point||{x:o.x+ray.x*110,y:o.y+ray.y*110,z:o.z+ray.z*110}});
   }
  }else if(event.type==='melee'){a.spawnUntil=Math.min(a.spawnUntil,this.time);const victim=this.meleeTarget(a);if(victim){const info=this.damage(victim,1000,a);if(info)result.push({...info,zone:'torso'});}}
  this.events.push({...event,actor:a.id,position:copyPos(a.body)});return result;
 }
 lineTarget(attacker,o,d,range=110){const end={x:o.x+d.x*range,y:o.y+d.y*range,z:o.z+d.z*range},wall=obstruction(this.world.colliders,o,end)*range;let best=wall,actor=null,zone=null;
  for(const a of this.actors){if(a===attacker||!a.alive)continue;const p=a.body;if(distance(o,p)>range+1)continue;
   const crouch=p.height/1.82;for(const [part,y,r]of [['head',1.64,.22],['torso',1.16,.33],['limb',.52,.30]]){const t=sphereDistance(o,d,{x:p.x,y:p.y+y*crouch,z:p.z},r);if(t<best-.002){best=t;actor=a;zone=part;}}
  }return{actor,zone,distance:best,point:{x:o.x+d.x*best,y:o.y+d.y*best,z:o.z+d.z*best}};
 }
 meleeTarget(a){let selected=null,best=Infinity;const p=a.body,o=chest(a);for(const b of this.actors){if(!b.alive||!this.enemy(a,b)||this.time<b.spawnUntil)continue;const d=distance(p,b.body);if(d>2.7+1e-9||Math.abs(p.y-b.body.y)>.95)continue;const t=chest(b);if(obstruction(this.world.colliders,o,t)<.999)continue;const yaw=Math.atan2(-(t.x-o.x),-(t.z-o.z)),rank=d+Math.abs(angleDelta(a.yaw,yaw))*.6;if(rank<best){best=rank;selected=b;}}return selected;}
 damage(a,amount,source){if(!a.alive||this.time<a.spawnUntil||!this.enemy(source,a))return null;const shield=Math.min(a.shield,amount);a.shield-=shield;a.health=Math.max(0,a.health-(amount-shield));a.hit=.25;a.lastDamage=this.time;this.events.push({type:shield?'shield-hit':'health-hit',actor:a.id,position:copyPos(a.body)});if(!a.human&&!a.target){a.memory={x:source.body.x+(a.rng()-.5)*4,y:source.body.y,z:source.body.z+(a.rng()-.5)*4,expires:this.time+3,id:null};}
  const killed=a.health<=0;if(killed){a.alive=false;a.deaths++;a.deadUntil=this.time+3.2;a.deathTime=this.time;source.kills++;this.score[source.team]++;a.body.vx=a.body.vy=a.body.vz=0;this.events.push({type:'elimination',actor:a.id,killer:source.id,position:copyPos(a.body)});}
  return{target:a.id,damage:amount,killed};
 }
 finish(){this.ended=true;this.running=false;const ranked=[...this.actors].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths);this.result={winner:this.config.mode==='tdm'?(this.score.red===this.score.blue?'EMPATE':this.score.red>this.score.blue?'ROJO':'AZUL'):ranked[0].name,ranked:ranked.map(a=>({name:a.name,team:a.team,kills:a.kills,deaths:a.deaths}))};this.events.push({type:'finished'});}
 snapshot(){return{time:this.time,mode:this.config.mode,score:{...this.score},running:this.running,ended:this.ended,bots:this.bots.map(b=>({id:b.id,state:b.state,profile:b.profile.name,x:b.body.x,y:b.body.y,z:b.body.z,speed:b.body.speed,alive:b.alive,health:b.health,shield:b.shield,weapon:b.arsenal.weapon.id,path:b.path.length-b.pathAt,target:b.target?.id??null,ammo:b.arsenal.ammo,reserve:b.arsenal.reserve})),metrics:{...this.metrics}};}
}
