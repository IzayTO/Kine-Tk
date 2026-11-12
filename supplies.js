// Authoritative supply/consumable state; no DOM, rendering or wall-clock timers.
import {clamp} from './physics.js';
import {obstruction} from './navigation.js';
export const CONSUMABLES=Object.freeze({bandage:{name:'VENDAJE',seconds:3.5,value:25,stat:'health',max:9},mini:{name:'MINIESCUDO',seconds:2,value:25,stat:'shield',max:9}});
export const OPEN_SECONDS=1;
const types=['rifle','shotgun','bandage','mini'];
const flat=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const chest=a=>({x:a.body.x,y:a.body.y+a.body.height*.7,z:a.body.z});
export class Supplies{
 constructor(match){this.match=match;this.drops=match.crates.flatMap(c=>types.map((kind,i)=>({id:c.id*4+i,crate:c.id,kind,amount:0,active:false,flyStart:-100,collector:null,x:c.x,y:c.y+.4,z:c.z})));}
 resetActor(a){a.inventory={bandage:0,mini:0};a.consuming=null;a.consumeUntil=0;a.consumedAt=-100;a.opening=null;a.maxNotice=-100;}
 reset(){for(const a of this.match.actors)this.resetActor(a);for(const d of this.drops){d.active=false;d.amount=0;d.flyStart=-100;d.collector=null;}}
 reachable(a,c,radius=3){return a.alive&&flat(a.body,c)<=radius+1e-9&&Math.abs(a.body.y-c.y)<1&&obstruction(this.match.world.colliders,chest(a),{x:c.x,y:c.y+.55,z:c.z})>.999;}
 nearest(a){let best=null,dist=3.000001;for(const c of this.match.crates){const d=flat(a.body,c);if(c.available&&d<dist&&this.reachable(a,c)){best=c;dist=d;}}return best;}
 hold(a,id,dt,held){const c=this.match.crates[id];if(!held||!this.match.running||this.match.ended||!c?.available||!this.reachable(a,c)){a.opening=null;return false;}if(a.consuming)return false;if(a.opening?.id!==id)a.opening={id,progress:0};a.opening.progress+=dt/OPEN_SECONDS;if(a.opening.progress+1e-8>=1){this.open(c,a);a.opening=null;return true;}return false;}
 open(c,a){if(!c.available)return false;const m=this.match;c.available=false;c.lid=1;c.ready=m.time+clamp(m.config.crateSeconds,20,90);c.openedAt=m.time;
  // Fixed positions over the valid crate footprint: no loot behind walls or on another floor.
  const amounts=[c.rifle,c.shotgun,c.id%2===0?3:0,c.id%2===1?3:0];
  for(let i=0;i<4;i++){const d=this.drops[c.id*4+i];d.amount=amounts[i];d.active=d.amount>0;d.born=m.time;d.flyStart=-100;d.collector=null;d.x=c.x+(i%2?1:-1)*.24;d.y=c.y+.52+(i>1?.3:0);d.z=c.z+(i>1?.18:-.18);}
  m.events.push({type:'crate',actor:a.id,position:{x:c.x,y:c.y,z:c.z}});return true;
 }
 request(a,kind){const def=CONSUMABLES[kind],m=this.match;if(!def||!a.alive||!m.running||m.ended||a.consuming||m.time<a.consumeUntil)return false;
  if(!a.inventory[kind]||a[def.stat]>=100||a.arsenal.reload)return false;
  a.opening=null;a.consuming={kind,start:m.time,end:m.time+def.seconds};m.events.push({type:'consume',actor:a.id,kind});return true;
 }
 cancel(a){a.consuming=null;a.opening=null;}
 pickup(a,d){const m=this.match;if(!d.active||d.amount<=0||m.time-d.born<.35||m.time-d.flyStart<.36||!this.reachable(a,d,1.6))return 0;let added=0;
  if(d.kind==='rifle'||d.kind==='shotgun')added=a.arsenal.supply(d.kind==='rifle'?d.amount:0,d.kind==='shotgun'?d.amount:0);
  else{const max=CONSUMABLES[d.kind].max;added=Math.min(d.amount,max-a.inventory[d.kind]);a.inventory[d.kind]+=added;}
  if(!added){if(a.human&&m.time-a.maxNotice>1.5){a.maxNotice=m.time;m.events.push({type:'supply-full',actor:a.id,kind:d.kind});}return 0;}
  d.amount-=added;d.active=d.amount>0;d.flyStart=m.time;d.collector=a;d.flyAmount=added;m.events.push({type:'supply',actor:a.id,kind:d.kind,amount:added,position:{x:d.x,y:d.y,z:d.z}});return added;
 }
 step(dt){const m=this.match;
  for(const c of m.crates)if(!c.available&&m.time>=c.ready){for(let i=0;i<4;i++){const d=this.drops[c.id*4+i];d.active=false;d.amount=0;}m.stock(c);c.lid=0;}
  for(const a of m.actors){if(!a.alive){this.cancel(a);continue;}
   if(a.consuming){const use=a.consuming,def=CONSUMABLES[use.kind];if(m.time+1e-8>=use.end){a[def.stat]=Math.min(100,a[def.stat]+def.value);a.inventory[use.kind]--;a.consuming=null;a.consumedKind=use.kind;a.consumedAt=m.time;a.consumeUntil=m.time+.25;m.events.push({type:'healed',actor:a.id,kind:use.kind});}}
   if(!a.human){if(!a.consuming&&!a.target){if(a.health<76&&a.inventory.bandage)this.request(a,'bandage');else if(a.shield<76&&a.inventory.mini)this.request(a,'mini');}
    const needy=a.arsenal.slots[1].reserve<180||a.arsenal.slots[2].reserve<28||a.health<76||a.shield<76;
    const c=needy?this.nearest(a):null;this.hold(a,c?.id,dt,!!c&&flat(a.body,c)<1.55);
   }
   for(const d of this.drops)if(d.active)this.pickup(a,d);
  }
 }
}
