import * as T from './three.module.min.js';
import {clamp} from './physics.js';
import {KillPhrases,vignetteState} from './combat-feedback.js';
import {CONSUMABLES} from './supplies.js';
const $=id=>document.getElementById(id);
export class CombatUI{
 constructor(match,view,input,preferences,active,toast){Object.assign(this,{match,view,input,preferences,active,toast});this.phrases=new KillPhrases();this.vector=new T.Vector3();this.heldCrate=null;this.crateId=null;this.nextCrate=0;
  this.rows=Array.from({length:4},()=>{const el=document.createElement('button');el.type='button';el.className='kill-row';el.innerHTML='<b></b><span></span><b></b>';const row={el,killer:el.children[0],phrase:el.children[1],victim:el.children[2],at:-100};el.onclick=()=>{if(active())row.at=-100;};$('kill-feed').append(el);return row;});this.rowIndex=0;
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
 reset(){this.phrases=new KillPhrases();for(const r of this.rows)r.at=-100;this.heldCrate=null;this.crateId=null;this.nextCrate=0;this.lastCount='';}
 step(dt){if(!this.active()){this.heldCrate=null;return;}this.match.supplies.hold(this.match.player,this.heldCrate,dt,this.heldCrate!==null);}
 onEvent(e){const m=this.match;if(e.type==='elimination'){
   const row=this.rows.reduce((a,b)=>a.at<b.at?a:b);row.at=m.time;row.killer.textContent=e.killerName||m.actors.find(a=>a.id===e.killer)?.name||'Jugador';row.victim.textContent=e.victimName||'Soldado';row.killer.className='name-'+e.killerTeam;row.victim.className='name-'+e.victimTeam;row.phrase.textContent=' '+this.phrases.next(e.weapon)+' ';row.el.style.order=String(-Math.round(m.time*1000));
  }
  if(e.actor!==0)return;if(e.type==='supply-full')this.toast(['rifle','shotgun'].includes(e.kind)?'Munición máx.':'Consumibles máx.');
  if(e.type==='supply')this.toast('+'+e.amount+' '+({rifle:'cartuchos K-09',shotgun:'cartuchos S-07',bandage:'vendajes',mini:'miniescudos'}[e.kind]||'munición'));
 }
 project(x,y,z){const v=this.vector;v.set(x,y,z).project(this.view.camera);return v.z>-1&&v.z<1&&Math.abs(v.x)<.96&&Math.abs(v.y)<.94;}
 frame(dt,editing=false){const m=this.match,a=m.player,time=m.time,enabled=this.active();if(!enabled){this.heldCrate=null;a.opening=null;}
  this.view.camera.updateMatrixWorld(true);
  const state=vignetteState(a,time);$('damage-feedback').style.opacity=String(state.damage);$('heal-feedback').style.opacity=String(state.healing);$('heal-feedback').classList.toggle('mini',state.color==='blue');
  // This entire overlay uses a bounded pool. Projection never waits for the slow numerical HUD.
  for(let i=0;i<this.arrows.length;i++){const el=this.arrows[i],b=m.bots[i];let visible=enabled&&b?.alive&&m.config.mode!=='ffa'&&!m.enemy(a,b);if(visible)visible=this.project(b.body.previous.x+(b.body.x-b.body.previous.x)*(this.view.visualAlpha??1),b.body.y+b.body.height+.25,b.body.previous.z+(b.body.z-b.body.previous.z)*(this.view.visualAlpha??1));el.hidden=!visible;
   if(visible){const d=Math.hypot(b.body.x-a.body.x,b.body.z-a.body.z),scale=clamp(1.2-d*.012,.48,1.2);el.style.transform=`translate(${(this.vector.x*.5+.5)*innerWidth}px,${(-this.vector.y*.5+.5)*innerHeight}px) translate(-50%,-100%) scale(${scale})`;}
  }
  if(time>=this.nextCrate||this.crateId===null){this.nextCrate=time+.08;const c=m.supplies.nearest(a);this.crateId=c?.id??null;}
  let crate=m.crates[this.heldCrate??this.crateId],show=enabled&&crate?.available&&m.supplies.reachable(a,crate);
  if(show)show=this.project(crate.x,crate.y+.9,crate.z);this.interact.hidden=!show;
  if(show){this.interact.style.transform=`translate(${(this.vector.x*.5+.5)*innerWidth}px,${(-this.vector.y*.5+.5)*innerHeight}px) translate(-50%,-50%)`;const q=a.opening?.id===crate.id?a.opening.progress:0;this.ring.style.strokeDashoffset=String(100*(1-clamp(q,0,1)));this.interact.setAttribute('aria-valuenow',String(Math.round(q*100)));}
  if(!show&&a.opening){a.opening=null;this.heldCrate=null;}
  for(const row of this.rows){const age=time-row.at;row.el.hidden=age>2.25&&!editing;row.el.style.opacity=editing?'0.8':String(age<2?1:clamp((2.25-age)/.25,0,1));if(editing&&row.at<0){row.killer.textContent='AZUL';row.killer.className='name-blue';row.phrase.textContent=' ganó el duelo contra ';row.victim.textContent='ROJO';row.victim.className='name-red';}}
  const use=a.consuming,done=time-(a.consumedAt??-100),visible=enabled&&(!!use||done<.45),bar=$('consume-progress');bar.hidden=!visible;
  if(visible){const kind=use?.kind||a.consumedKind,def=CONSUMABLES[kind],q=use?clamp((time-use.start)/def.seconds,0,1):1;bar.classList.toggle('mini',kind==='mini');bar.style.opacity=use?'1':String(clamp(1-done/.45,0,1));bar.style.translate=use?'0 0':`0 ${-done*7}px`;$('consume-label').textContent=use?def.name+' · '+Math.max(0,use.end-time).toFixed(1)+' s':'+25 '+(kind==='mini'?'ESCUDO':'VIDA');$('consume-fill').style.transform=`scaleX(${q})`;}
  const inv=a.inventory||{},countKey=[inv.bandage,inv.mini,!!use,editing].join('|');if(countKey!==this.lastCount){this.lastCount=countKey;for(const kind of ['bandage','mini']){const el=$('use-'+kind);el.hidden=!inv[kind]&&!editing;el.classList.toggle('consuming',use?.kind===kind);el.setAttribute('aria-disabled',String(!!use));el.querySelector('b').textContent=String(inv[kind]||0);}}
  const auto=document.querySelector('.auto-fire-button');auto.classList.toggle('selected',this.preferences.autoFire);auto.setAttribute('aria-pressed',String(this.preferences.autoFire));auto.querySelector('small').textContent=this.preferences.autoFire?'AUTO ON':'AUTO OFF';
 }
}
