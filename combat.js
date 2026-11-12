import {clamp} from './physics.js';
export const WEAPONS=Object.freeze([
 {id:'knife',name:'FILO',capacity:0,interval:.44,range:2.7},
 {id:'rifle',name:'K-09',capacity:40,reserve:360,interval:.105,reload:1.55},
 {id:'shotgun',name:'S-07',capacity:7,reserve:56,interval:.82,reload:.58,pellets:9}
]);
export const damageFor=(weapon,zone,distance)=>weapon==='knife'?1000:weapon==='rifle'?28*(zone==='head'?2:zone==='limb'?.65:1)*clamp(1-(distance-20)/100,.65,1):19*(zone==='head'?1.6:zone==='limb'?.7:1)*clamp(1-(distance-7)/30,.15,1);
export class Arsenal{
 constructor(){this.time=0;this.selected=1;this.slots=WEAPONS.map(w=>({ammo:w.capacity,reserve:w.reserve||0,ready:0}));this.mode='auto';this.shotgunMode='pump';this.autoReload=true;this.reload=null;this.switchUntil=0;this.attack=null;this.combo=0;this.queuedAttack=false;this.previousFire=false;this.pumpAt=Infinity;this.lastShot=-100;this.bloom=0;this.shots=0;}
 get weapon(){return WEAPONS[this.selected];}get ammo(){return this.slots[this.selected].ammo;}
 get reserve(){return this.slots[this.selected].reserve;}
 get interval(){return this.selected===2&&this.shotgunMode==='tactical'?.48:this.weapon.interval;}
 refill(){for(let i=0;i<3;i++){this.slots[i].ammo=WEAPONS[i].capacity;this.slots[i].reserve=WEAPONS[i].reserve||0;this.slots[i].ready=this.time;}this.reload=null;this.attack=null;this.queuedAttack=false;this.previousFire=false;this.switchUntil=this.time;this.pumpAt=Infinity;this.bloom=0;}
 supply(rifle=0,shotgun=0){let added=0;for(const [i,n]of [[1,rifle],[2,shotgun]]){const s=this.slots[i],a=Math.min(Math.max(0,n),WEAPONS[i].reserve-s.reserve);s.reserve+=a;added+=a;}return added;}
 select(slot){if(slot===this.selected||!WEAPONS[slot])return false;this.selected=slot;this.pumpAt=Infinity;this.reload=null;this.attack=null;this.queuedAttack=false;this.switchUntil=this.time+.24;return true;}
 toggleMode(){if(this.selected===1)this.mode=this.mode==='auto'?'semi':'auto';else if(this.selected===2)this.shotgunMode=this.shotgunMode==='pump'?'tactical':'pump';}
 requestReload(){if(this.selected===0||this.reload||this.ammo>=this.weapon.capacity||this.reserve<=0||this.time<this.switchUntil)return false;this.reload={weapon:this.selected,start:this.time,next:this.time+(this.selected===1?this.weapon.reload:.62)};return true;}
 spread(context={}){if(this.selected===0)return 0;const degrees=this.selected===2?(context.aim?1.85:2.7):context.aim?0:.18;return (degrees+(this.selected===1&&context.aim?0:Math.min(1,(context.speed||0)/12)*.16+(context.grounded===false?.28:0)+this.bloom))*Math.PI/180;}
 step(dt,input={},context={},emit=()=>{}){
  this.time+=dt;if(this.time>=this.pumpAt){this.pumpAt=Infinity;emit({type:'pump',weapon:'shotgun'});}this.bloom=Math.max(0,this.bloom-dt*.8);const edge=!!input.fireStart||!!input.fire&&!this.previousFire;this.previousFire=!!input.fire;
  if(this.reload&&this.selected===2&&(edge||input.fire)&&this.ammo>0)this.reload=null;
  if(this.reload&&this.time+1e-8>=this.reload.next){if(this.selected===1){const s=this.slots[1],n=Math.min(40-s.ammo,s.reserve);s.ammo+=n;s.reserve-=n;this.reload=null;emit({type:'loaded',weapon:'rifle'});}else{this.slots[2].ammo++;this.slots[2].reserve--;emit({type:'shell',weapon:'shotgun'});if(this.ammo>=7||this.reserve<=0)this.reload=null;else this.reload.next+=this.weapon.reload;}}
  if(this.attack){if(edge&&this.time-this.attack.start>this.attack.duration-.18)this.queuedAttack=true;
   if(!this.attack.hit&&this.time>=this.attack.start+.15){this.attack.hit=true;emit({type:'melee',weapon:'knife',combo:this.attack.combo});}
   if(this.time>=this.attack.start+this.attack.duration)this.attack=null;
  }
  if(!context.busy&&this.autoReload&&this.selected!==0&&this.ammo===0&&this.reserve>0&&!this.reload&&this.time>=this.switchUntil){if(this.requestReload())emit({type:'reload',weapon:this.weapon.id});}
  if(context.busy||this.time<this.switchUntil||this.reload||this.attack)return;
  const trigger=this.selected===1&&this.mode==='semi'?edge:edge||input.fire||this.selected===0&&this.queuedAttack;
  const slot=this.slots[this.selected];if(!trigger||this.time+1e-8<slot.ready)return;
  if(this.selected!==0&&slot.ammo===0){if(edge)emit({type:'empty'});return;}
  if(this.selected===0){const combo=this.combo++%3,duration=[.42,.44,.52][combo];this.attack={combo,start:this.time,duration,hit:false};this.queuedAttack=false;slot.ready=this.time+duration;emit({type:'swing',weapon:'knife',combo});return;}
  slot.ammo--;if(this.selected===2)this.pumpAt=this.time+(this.shotgunMode==='pump'?.15:.09);this.lastShot=this.time;this.shots++;const spread=this.spread(context);this.bloom=Math.min(.32,this.bloom+.09);
  // Carry only one interval of fractional scheduling error; no idle backlog.
  slot.ready=Math.max(slot.ready,this.time-dt)+this.interval;
  emit({type:'shot',weapon:this.weapon.id,pellets:this.weapon.pellets||1,spread,time:this.time});
 }
 get reloadProgress(){if(!this.reload)return 0;const duration=this.selected===1?1.55:.58;return clamp(1-(this.reload.next-this.time)/duration,0,1);}
}
export function knifePose(combo,t){
 const tracks=[[[0,0,0],[.08,.08,.02],[-.30,.015,-.18],[-.08,0,0]],[[-.08,0,0],[-.20,.06,-.02],[.25,.06,-.20],[.06,.03,0]],[[.06,.03,0],[.04,.23,-.04],[-.07,-.14,-.24],[0,0,0]]];
 const points=tracks[combo%3],times=[0,.22,.53,1];let i=0;while(i<2&&t>times[i+1])i++;let q=clamp((t-times[i])/(times[i+1]-times[i]),0,1);q=q*q*(3-2*q);return points[i].map((v,j)=>v+(points[i+1][j]-v)*q);
}
