import * as T from './three.module.min.js';
import {clamp} from './physics.js';
import {KillPhrases,FeedQueue,DeathPhrases,deathState,vignetteState} from './combat-feedback.js';
import {CONSUMABLES} from './supplies.js';
const $=id=>document.getElementById(id);
export class CombatUI{
 constructor(match,view,input,preferences,active,toast){Object.assign(this,{match,view,input,preferences,active,toast});this.phrases=new KillPhrases();this.feed=new FeedQueue();this.deathPhrases=new DeathPhrases();this.deathStamp=null;this.deathExit=-100;this.wasDead=false;this.vector=new T.Vector3();this.heldCrate=null;this.crateId=null;this.nextCrate=0;
  this.rows=Array.from({length:4},()=>{const el=document.createElement('button');el.type='button';el.className='kill-row';el.innerHTML='<b></b><span></span><b></b>';const row={el,killer:el.children[0],phrase:el.children[1],victim:el.children[2],at:-100,sequence:null};el.onclick=()=>{if(active()&&row.sequence!==null)this.feed.dismiss(row.sequence,this.match.time);};$('kill-feed').append(el);return row;});
  this.arrows=Array.from({length:20},()=>{const el=document.createElement('span');el.className='ally-arrow';el.textContent='⌄';el.hidden=true;$('ally-indicators').append(el);return el;});
  this.interact=$('crate-interact');this.ring=this.interact.querySelector('.interact-progress');
  this.interact.addEventListener('pointerdown',e=>{if(!active()||this.crateId===null||this.pointer!==undefined)return;e.preventDefault();e.stopPropagation();this.pointer=e.pointerId;this.heldCrate=this.crateId;try{this.interact.setPointerCapture(e.pointerId);}catch{}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])this.interact.addEventListener(type,e=>{if(e.pointerId===this.pointer){this.heldCrate=null;this.pointer=undefined;}});
  window.addEventListener('keydown',e=>{if(e.code==='KeyE'&&!e.repeat&&active()&&!e.target.matches('input,select,textarea')){e.preventDefault();this.heldCrate=this.crateId;}});
  window.addEventListener('keyup',e=>{if(e.code==='KeyE')this.heldCrate=null;});
  const ammo=document.querySelector('.weapon-info');ammo.setAttribute('role','group');ammo.setAttribute('aria-label','Munición. Toca para recargar');ammo.tabIndex=0;
  ammo.addEventListener('pointerdown',e=>{if(!active()||e.target.closest('#auto-reload'))return;e.preventDefault();e.stopPropagation();input.actions.push('reload');});
  ammo.addEventListener('keydown',e=>{if(active()&&e.target===ammo&&['Enter','Space'].includes(e.code)){e.preventDefault();input.actions.push('reload');}});
 }
 reset(){this.phrases=new KillPhrases();this.feed.reset();for(const r of this.rows){r.at=-100;r.sequence=null;r.el.hidden=true;}this.heldCrate=null;this.pointer=undefined;this.crateId=null;this.nextCrate=0;this.lastCount='';this.deathStamp=null;this.wasDead=false;this.deathExit=-100;document.body.classList.remove('player-dead');}
 step(dt,sample={}){if(!this.active()){this.heldCrate=null;return;}const a=this.match.player;let id=this.heldCrate;
  if(id===null&&this.preferences.autoInteract&&!sample.fire&&!sample.fireStart&&!a.arsenal.reload&&!a.consuming){const yaw=this.input.yaw,pitch=this.input.pitch,c=this.match.supplies.lookedAt(a,{x:a.body.x,y:a.body.y+this.view.eye,z:a.body.z},{x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)});id=c?.id??null;}
  this.match.supplies.hold(a,id,dt,id!==null);
 }
 onEvent(e){const m=this.match;if(e.type==='elimination'){
   this.feed.push({killer:e.killerName||m.actors.find(a=>a.id===e.killer)?.name||'Jugador',victim:e.victimName||'Soldado',killerTeam:e.killerTeam,victimTeam:e.victimTeam,phrase:this.phrases.next(e.weapon)});
  }
  if(e.actor!==0)return;if(e.type==='supply-full')this.toast(['rifle','shotgun'].includes(e.kind)?'Munición máx.':'Consumibles máx.');
  if(e.type==='supply')this.toast('+'+e.amount+' '+({rifle:'cartuchos K-09',shotgun:'cartuchos S-07',bandage:'vendajes',mini:'miniescudos'}[e.kind]||'munición'));
 }
 project(x,y,z){const v=this.vector;v.set(x,y,z).project(this.view.camera);return v.z>-1&&v.z<1&&Math.abs(v.x)<.96&&Math.abs(v.y)<.94;}
 updateFeed(time,editing){const entries=this.feed.update(time);
  for(const r of this.rows)if(!entries.some(e=>e.sequence===r.sequence))r.sequence=null;
  for(const e of entries){let r=this.rows.find(r=>r.sequence===e.sequence);if(!r){r=this.rows.find(r=>r.sequence===null);r.sequence=e.sequence;r.at=e.at;r.killer.textContent=e.killer;r.victim.textContent=e.victim;r.killer.className='name-'+e.killerTeam;r.victim.className='name-'+e.victimTeam;r.phrase.textContent=' '+e.phrase+' ';r.el.title=e.killer+' '+e.phrase+' '+e.victim;}}
  for(const [i,r]of this.rows.entries()){const index=entries.findIndex(e=>e.sequence===r.sequence),age=time-r.at;r.el.hidden=index<0&&!editing;r.el.style.top=((index<0?i:index)*20)+'px';r.el.style.opacity=editing?'0.8':String(Math.min(clamp(age/.18,0,1),clamp((3.24-age)/.24,0,1)));r.el.style.transform=`translateX(${editing?0:Math.max(0,1-age/.22)*12}px)`;
   if(editing&&index<0){r.killer.textContent='AZUL';r.killer.className='name-blue';r.phrase.textContent=' ganó el duelo contra ';r.victim.textContent='ROJO';r.victim.className='name-red';}}
 }
 updateDeath(time,editing){const a=this.match.player,visible=!$('hud').hidden&&!editing,dead=!a.alive&&this.match.running&&!this.match.ended;
  if(dead&&this.deathStamp!==a.deathTime){this.deathStamp=a.deathTime;$('death-title').textContent=this.deathPhrases.next();}
  if(this.wasDead&&!dead)this.deathExit=time;this.wasDead=dead;
  const exit=dead?1:clamp(1-(time-this.deathExit)/.28,0,1),show=visible&&(dead||exit>0),s=deathState(Math.max(0,time-(this.deathStamp??time)));
  document.body.classList.toggle('player-dead',visible&&dead);$('death-feedback').hidden=!show;
  $('death-black').style.opacity=show?String(s.black*exit):'0';$('death-red').style.opacity=show?String(s.red*exit):'0';
  if(show){$('death-title').style.opacity=String(s.text*exit);$('death-title').style.transform=`translateY(${s.lift-(1-exit)*5}px) scale(${s.scale})`;$('death-countdown').style.opacity=String(s.text*exit);$('death-countdown').textContent='ELIMINADO · REAPARICIÓN EN '+Math.max(0,a.deadUntil-time).toFixed(1)+' s';}
 }
 frame(dt,editing=false){const m=this.match,a=m.player,time=m.time,enabled=this.active();if(!enabled){this.heldCrate=null;a.opening=null;}
  this.view.camera.updateMatrixWorld(true);
  const state=vignetteState(a,time),showFX=!$('hud').hidden&&!editing;$('damage-feedback').style.opacity=showFX?String(state.damage):'0';$('heal-feedback').style.opacity=showFX?String(state.healing):'0';$('heal-feedback').classList.toggle('mini',state.color==='blue');this.updateDeath(time,editing);
  // This entire overlay uses a bounded pool. Projection never waits for the slow numerical HUD.
  for(let i=0;i<this.arrows.length;i++){const el=this.arrows[i],b=m.bots[i];let visible=enabled&&b?.alive&&m.config.mode!=='ffa'&&!m.enemy(a,b);if(visible)visible=this.project(b.body.previous.x+(b.body.x-b.body.previous.x)*(this.view.visualAlpha??1),b.body.y+b.body.height+.25,b.body.previous.z+(b.body.z-b.body.previous.z)*(this.view.visualAlpha??1));el.hidden=!visible;
   if(visible){const d=Math.hypot(b.body.x-a.body.x,b.body.z-a.body.z),scale=clamp(1.2-d*.012,.48,1.2);el.style.transform=`translate(${(this.vector.x*.5+.5)*innerWidth}px,${(-this.vector.y*.5+.5)*innerHeight}px) translate(-50%,-100%) scale(${scale})`;}
  }
  if(time>=this.nextCrate||this.crateId===null){this.nextCrate=time+.08;const c=m.supplies.nearest(a);this.crateId=c?.id??null;}
  let crate=m.crates[a.opening?.id??this.heldCrate??this.crateId],show=enabled&&crate?.available&&m.supplies.reachable(a,crate);
  if(show)show=this.project(crate.x,crate.y+.9,crate.z);this.interact.hidden=!show;
  if(show){this.interact.style.transform=`translate(${(this.vector.x*.5+.5)*innerWidth}px,${(-this.vector.y*.5+.5)*innerHeight}px) translate(-50%,-50%)`;const q=a.opening?.id===crate.id?a.opening.progress:0;this.ring.style.strokeDashoffset=String(100*(1-clamp(q,0,1)));this.interact.setAttribute('aria-valuenow',String(Math.round(q*100)));}
  if(!show&&a.opening){a.opening=null;this.heldCrate=null;}
  this.updateFeed(time,editing);
  const use=a.consuming,done=time-(a.consumedAt??-100),visible=enabled&&(!!use||done<.45),bar=$('consume-progress');bar.hidden=!visible;
  if(visible){const kind=use?.kind||a.consumedKind,def=CONSUMABLES[kind],q=use?clamp((time-use.start)/def.seconds,0,1):1;bar.classList.toggle('mini',kind==='mini');bar.style.opacity=use?'1':String(clamp(1-done/.45,0,1));bar.style.translate=use?'0 0':`0 ${-done*7}px`;$('consume-label').textContent=use?def.name+' · '+Math.max(0,use.end-time).toFixed(1)+' s':'+25 '+(kind==='mini'?'ESCUDO':'VIDA');$('consume-fill').style.transform=`scaleX(${q})`;}
  const inv=a.inventory||{},countKey=[inv.bandage,inv.mini,!!use,editing].join('|');if(countKey!==this.lastCount){this.lastCount=countKey;for(const kind of ['bandage','mini']){const el=$('use-'+kind);el.hidden=!inv[kind]&&!editing;el.classList.toggle('consuming',use?.kind===kind);el.setAttribute('aria-disabled',String(!!use));el.querySelector('b').textContent=String(inv[kind]||0);}}
  const auto=document.querySelector('.auto-fire-button');auto.classList.toggle('selected',this.preferences.autoFire);auto.setAttribute('aria-pressed',String(this.preferences.autoFire));auto.querySelector('small').textContent=this.preferences.autoFire?'AUTO ON':'AUTO OFF';
 }
}
