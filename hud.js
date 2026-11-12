import {clamp} from './physics.js';
import {radarOpacity} from './combat-feedback.js';
export const HUD_ITEMS=[
 ['joystick','Joystick',128,128,.105,.79,1],['.sprint-button','Sprint',49,49,.105,.49,1],
 ['.jump-button','Salto',58,58,.91,.63,1],['.slide-button','Deslizamiento',58,58,.91,.85,1],
 ['.fire-button','Disparo',76,76,.79,.77,1],['.aim-button','Apuntar',47,47,.76,.48,1],
 ['.reload-button','Recarga',43,43,.91,.40,1],['.ping-button','Marcador',40,40,.65,.43,1],
 ['.assist-button','Asistencia',40,40,.65,.60,1],['.auto-fire-button','Autodisparo',48,48,.22,.62,1],['.mode-button','Modo de disparo',42,42,.65,.78,1],
 ['weapon-slots','Armas',174,44,.49,.93,1],['minimap','Minimapa',108,108,.095,.25,0],
 ['.telemetry','Velocidad',174,57,.44,.75,0],['.weapon-info','Munición',190,65,.85,.19,0],
 ['consumable-slots','Consumibles',118,44,.49,.79,1],['kill-feed','Bajas',250,78,.32,.27,0],
 ['health-bar','Vida',156,30,.28,.88,0],['shield-bar','Escudo',156,30,.28,.80,0],['score-bar','Puntuación',176,34,.50,.07,0],['match-status','Partida',176,28,.50,.15,0],
 ['.location','Ubicación',145,27,.12,.06,0],['.hud-actions','Menú',156,44,.87,.065,1]
];
const copy=x=>JSON.parse(JSON.stringify(x));
export const orientation=(w,h)=>w>=h?'landscape':'portrait';
export function clampLayout(value,base,rect){
  const minScale=Math.max(0.55,base.control?44/Math.min(base.w,base.h):0.55);
  const scale=clamp(Number(value.scale)||1,minScale,Math.min(1.6,rect.w/base.w,rect.h/base.h));
  const hx=base.w*scale/2/rect.w,hy=base.h*scale/2/rect.h;
  return {x:clamp(Number.isFinite(value.x)?value.x:0.5,hx,1-hx),y:clamp(Number.isFinite(value.y)?value.y:0.5,hy,1-hy),scale,opacity:clamp(Number.isFinite(value.opacity)?value.opacity:1,0,1)};
}
export class LayoutStore{
  constructor(storage){this.storage=storage;this.layouts={landscape:{},portrait:{}};try{const s=JSON.parse(storage?.getItem('kinetic-hud-v2'));if(s)for(const o of ['landscape','portrait'])if(s[o]&&typeof s[o]==='object')this.layouts[o]=s[o];}catch{}this.draft=null;}
  begin(){this.draft=copy(this.layouts);}
  get current(){return this.draft||this.layouts;}
  save(){if(this.draft){this.layouts=copy(this.draft);this.draft=null;}try{this.storage?.setItem('kinetic-hud-v2',JSON.stringify(this.layouts));return true;}catch{return false;}}
  cancel(){this.draft=null;}
  reset(o){this.current[o]={};}
}
export class HUDEditor{
  constructor({onClose=()=>{},storage=globalThis.localStorage,touch=false}={}){
    this.store=new LayoutStore(storage);this.onClose=onClose;this.touch=touch;this.editing=false;this.preview=false;this.selected=null;this.drag=null;this.items=[];
    this.probe=document.createElement('div');this.probe.style.cssText='position:fixed;pointer-events:none;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';document.body.append(this.probe);
    this.bar=document.getElementById('hud-editor');
    document.getElementById('hud-collapse').onclick=()=>{const folded=this.bar.classList.toggle('collapsed');document.getElementById('hud-collapse').textContent=folded?'⌄':'⌃';document.getElementById('hud-collapse').setAttribute('aria-expanded',String(!folded));};this.selector=document.getElementById('hud-selection');
    for(const [selector,label,w,h,x,y,control]of HUD_ITEMS){
      const el=document.querySelector(selector.startsWith('.')?selector:'#'+selector);if(!el)continue;
      const shell=document.createElement('div');shell.className='hud-shell'+(control&&!['weapon-slots','consumable-slots','.hud-actions'].includes(selector)?' hud-control':'');shell.dataset.label=label;shell.dataset.hud=label;
      el.parentNode.insertBefore(shell,el);shell.append(el);el.classList.add('hud-visual');const item={id:selector,label,w,h,x,y,control:!!control,el,shell};this.items.push(item);
      shell.addEventListener('pointerdown',e=>{if(!this.editing||this.preview)return;e.preventDefault();e.stopImmediatePropagation();if(this.drag)return;this.select(item);try{shell.setPointerCapture(e.pointerId);}catch{}const r=shell.getBoundingClientRect();this.drag={id:e.pointerId,item,dx:e.clientX-(r.left+r.width/2),dy:e.clientY-(r.top+r.height/2)};},true);
      shell.addEventListener('pointermove',e=>{if(!this.editing)return;e.stopImmediatePropagation();if(this.drag?.id!==e.pointerId)return;const r=this.safeRect(),item=this.drag.item,v=this.value(item);v.x=(e.clientX-this.drag.dx-r.x)/r.w;v.y=(e.clientY-this.drag.dy-r.y)/r.h;this.set(item,v);},true);
      const release=e=>{if(this.editing)e.stopImmediatePropagation();if(this.drag?.id===e.pointerId)this.drag=null;};for(const event of ['pointerup','pointercancel','lostpointercapture'])shell.addEventListener(event,release,true);
      shell.addEventListener('click',e=>{if(this.editing){e.preventDefault();e.stopImmediatePropagation();}},true);
    }
    const handle=document.getElementById('hud-move');let moving=null;
    handle.addEventListener('pointerdown',e=>{if(!this.editing||!this.selected)return;e.preventDefault();const v=this.value(this.selected);moving={id:e.pointerId,x:e.clientX,y:e.clientY,v};try{handle.setPointerCapture(e.pointerId);}catch{}});
    handle.addEventListener('pointermove',e=>{if(moving?.id!==e.pointerId)return;const r=this.safeRect();this.set(this.selected,{...moving.v,x:moving.v.x+(e.clientX-moving.x)/r.w,y:moving.v.y+(e.clientY-moving.y)/r.h});});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(ev,()=>moving=null);
    document.getElementById('hud-size').addEventListener('input',e=>{if(this.selected){const v=this.value(this.selected);v.scale=+e.target.value/100;this.set(this.selected,v);this.updateBar();}});
    document.getElementById('hud-opacity').addEventListener('input',e=>{if(this.selected){const v=this.value(this.selected);v.opacity=+e.target.value/100;this.set(this.selected,v);this.updateBar();}});
    document.getElementById('hud-save').onclick=()=>this.close(true);
    document.getElementById('hud-cancel').onclick=()=>this.close(false);
    document.getElementById('hud-defaults').onclick=()=>{this.store.reset(this.mode);this.apply();this.updateBar();};
    document.getElementById('hud-preview').onclick=()=>{this.preview=!this.preview;document.body.classList.toggle('hud-preview',this.preview);document.getElementById('hud-preview').textContent=this.preview?'Volver a editar':'Vista previa';};
    for(const item of this.items){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.label;this.selector.append(opt);}this.selector.onchange=()=>this.select(this.items.find(i=>i.id===this.selector.value));
    window.addEventListener('resize',()=>{this.drag=null;this.apply();this.updateBar();});this.apply();
  }
  safeRect(){const s=getComputedStyle(this.probe),x=parseFloat(s.paddingLeft)||0,y=parseFloat(s.paddingTop)||0;return{x,y,w:Math.max(1,innerWidth-x-(parseFloat(s.paddingRight)||0)),h:Math.max(1,innerHeight-y-(parseFloat(s.paddingBottom)||0))};}
  get mode(){return orientation(innerWidth,innerHeight);}
  defaultValue(item){let x=item.x,y=item.y;if(this.mode==='portrait'){if(item.control){x=(item.id==='joystick'||item.id==='.sprint-button')?.19:item.x;y=item.id==='joystick'?.83:item.id==='.sprint-button'?.64:Math.max(.55,item.y);}const portrait={'.auto-fire-button':[.20,.55],'.ping-button':[.54,.61],'.assist-button':[.54,.70],'.mode-button':[.54,.79],'.aim-button':[.72,.61],'.reload-button':[.91,.50],'.jump-button':[.91,.65],'.slide-button':[.91,.89]};if(item.id==='consumable-slots'){x=.50;y=.87;}if(item.id==='kill-feed'){x=.45;y=.39;}if(item.id==='health-bar'){x=.25;y=.43;}if(item.id==='shield-bar'){x=.75;y=.43;}if(item.id==='score-bar'){x=.5;y=.29;}if(item.id==='match-status'){x=.5;y=.34;}if(portrait[item.id])[x,y]=portrait[item.id];if(item.id==='minimap'){x=.17;y=.17;}if(item.id==='.telemetry'){x=.5;y=.52;}if(item.id==='weapon-slots'){x=.50;y=.95;}if(item.id==='.weapon-info'){x=.76;y=.14;}}else if(!this.touch){if(item.id==='.telemetry'){x=.12;y=.9;}if(item.id==='.weapon-info'){x=.89;y=.9;}}
    return{x,y,scale:1,opacity:1};}
  value(item){return clampLayout(this.store.current[this.mode][item.id]||this.defaultValue(item),item,this.safeRect());}
  set(item,value){this.store.current[this.mode][item.id]=clampLayout(value,item,this.safeRect());this.applyItem(item);}
  applyItem(item){const v=this.value(item),r=this.safeRect();item.shell.style.cssText=`left:${r.x+v.x*r.w}px;top:${r.y+v.y*r.h}px;width:${item.w*v.scale}px;height:${item.h*v.scale}px;`;item.el.style.setProperty('width',item.w+'px','important');item.el.style.setProperty('height',item.h+'px','important');item.el.style.setProperty('transform',`translate(-50%,-50%) scale(${v.scale})`,'important');item.el.style.opacity=v.opacity;item.shell.classList.toggle('invisible-control',v.opacity<0.05);}
  apply(){for(const item of this.items)this.applyItem(item);}
  begin(){this.store.begin();this.editing=true;this.preview=false;this.drag=null;document.body.classList.add('hud-editing');this.bar.hidden=false;document.getElementById('hud-preview').textContent='Vista previa';this.bar.style.transform='';this.bar.classList.remove('collapsed');document.getElementById('hud-collapse').textContent='⌃';this.apply();this.select(this.items[0]);}
  select(item){this.selected=item;for(const i of this.items)i.shell.classList.toggle('selected-hud',i===item);this.updateBar();}
  updateBar(){if(!this.selected)return;const v=this.value(this.selected),size=document.getElementById('hud-size');size.min=Math.round(Math.max(.55,this.selected.control?44/Math.min(this.selected.w,this.selected.h):.55)*100);size.value=Math.round(v.scale*100);document.getElementById('hud-opacity').value=Math.round(v.opacity*100);this.selector.value=this.selected.id;document.getElementById('hud-size-value').textContent=Math.round(v.scale*100)+'%';document.getElementById('hud-opacity-value').textContent=Math.round(v.opacity*100)+'%';}
  close(save){const persisted=save?this.store.save():(this.store.cancel(),true);this.editing=false;this.preview=false;this.drag=null;this.bar.hidden=true;document.body.classList.remove('hud-editing','hud-preview');for(const i of this.items)i.shell.classList.remove('selected-hud');this.apply();this.onClose({save,persisted});}
}
export class Minimap{
  constructor(canvas,level){this.canvas=canvas;this.ctx=canvas.getContext('2d');canvas.width=240;canvas.height=240;this.base=document.createElement('canvas');this.base.width=256;this.base.height=256;const c=this.base.getContext('2d');c.fillStyle='#172f36';c.fillRect(0,0,256,256);c.translate(128,128);c.scale(2.45,2.45);
    for(const v of level.visuals){if(v.id==='ground'||v.h>8||v.id.includes('roof')||v.id.includes('route'))continue;c.fillStyle=v.mat==='asphalt'?'#344e55':v.mat==='coral'?'#c17859':v.mat==='steel'?'#57777c':'#7e9492';c.strokeStyle='#b2d1c444';c.lineWidth=.15;c.beginPath();if(v.type==='box'){c.save();c.translate(v.x,v.z);c.rotate(v.angle);c.rect(-v.w/2,-v.d/2,v.w,v.d);c.fill();c.stroke();c.restore();}else{v.poly.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fill();c.stroke();}}
    c.font='bold 4px sans-serif';c.textAlign='center';c.fillStyle='#daeee1';for(const [x,z,s]of [[-30,0,'T'],[4,-32,'C'],[25,6,'R'],[0,32,'P']])c.fillText(s,x,z);this.last=-Infinity;this.ms=0;this.radar=document.createElement('canvas');this.radar.width=this.radar.height=240;this.radar.className='radar-overlay';canvas.parentNode?.append(this.radar);this.radarCtx=this.radar.getContext('2d');this.radarPositions=new Map();
  }
  update(now,p,yaw,ping,rotate=false,force=false){if(!force&&now-this.last<.1)return;const t=performance.now();this.last=now;const c=this.ctx;c.clearRect(0,0,240,240);c.save();c.translate(120,120);if(rotate)c.rotate(yaw);c.drawImage(this.base,-120,-120,240,240);c.scale(240/104,240/104);if(ping){c.fillStyle='#ffc675';c.beginPath();c.arc(ping.x,ping.z,1.6,0,Math.PI*2);c.fill();}c.translate(p.x,p.z);c.rotate(-yaw);c.fillStyle='#a2ffda';c.beginPath();c.moveTo(0,-2.8);c.lineTo(2,2);c.lineTo(0,1);c.lineTo(-2,2);c.closePath();c.fill();c.restore();this.ms=performance.now()-t;}
  updateRadar(match,p,yaw,rotate,dt){const c=this.radarCtx;c.clearRect(0,0,240,240);if(!match.running)return;c.save();c.translate(120,120);if(rotate)c.rotate(yaw);c.scale(240/104,240/104);
   for(const a of match.actors){const shot=a.radarShot;if(!shot||!match.enemy(match.player,a))continue;const age=match.time-shot.at;let opacity=radarOpacity(age);if(age<.10)opacity=(shot.from||0)+(1-(shot.from||0))*Math.max(0,age/.10);if(opacity<=0)continue;
    let pos=this.radarPositions.get(a.id);if(!pos){pos={x:shot.x,z:shot.z};this.radarPositions.set(a.id,pos);}const q=1-Math.exp(-24*dt);pos.x+=(shot.x-pos.x)*q;pos.z+=(shot.z-pos.z)*q;
    c.save();c.translate(pos.x,pos.z);c.rotate(-shot.yaw);c.globalAlpha=opacity;c.fillStyle='#ff716b';c.strokeStyle='#351f25';c.lineWidth=.45;c.beginPath();c.moveTo(0,-2.3);c.lineTo(1.7,1.8);c.lineTo(0,1);c.lineTo(-1.7,1.8);c.closePath();c.fill();c.stroke();c.restore();
   }c.restore();
  }

}
export class Reticle{
  constructor(el,p){this.el=el;this.p=p;el.innerHTML='<svg viewBox="-100 -100 200 200"><path/><circle r="1"/></svg>';this.path=el.querySelector('path');this.dot=el.querySelector('circle');this.ring=document.createElementNS('http://www.w3.org/2000/svg','circle');this.ring.setAttribute('fill','none');el.querySelector('svg').append(this.ring);this.last='';}
  update(spreadRadians,verticalFov,height,weapon=null){const p=this.p,focal=height/(2*Math.tan(verticalFov*Math.PI/360));const shotgun=weapon==='shotgun',shape=shotgun?'square':p.reticleStyle,cone=p.reticleDynamic||shotgun?Math.tan(spreadRadians)*focal:0;const key=[shotgun,p.reticleDiameter,p.reticleStyle,p.reticleWidth,p.reticleLength,p.reticleGap,p.reticleSize,p.reticleColor,p.reticleOpacity,p.reticleDot,Math.round(cone*2)].join('|');if(key===this.last)return;this.last=key;
    const size=p.reticleSize,g=(p.reticleStyle==='cross'||p.reticleStyle==='crossdot'?0:p.reticleGap)*size+cone,l=p.reticleLength*size;
    this.path.setAttribute('d',`M${-g-l} 0h${l}M${g} 0h${l}M0 ${-g-l}v${l}M0 ${g}v${l}`);this.path.setAttribute('stroke',p.reticleColor);this.path.setAttribute('stroke-width',p.reticleWidth*size);if(shape==='square'){const r=shotgun?Math.max(22*size,cone):p.reticleDiameter*size/2+cone,k=r*.35;this.path.setAttribute('d',`M${-r} ${-r+k}v${-k}h${k}M${r-k} ${-r}h${k}v${k}M${r} ${r-k}v${k}h${-k}M${-r+k} ${r}h${-k}v${-k}`);}this.path.style.display=['dot','circle'].includes(shape)?'none':'';this.dot.setAttribute('r',Math.max(.5,p.reticleWidth*.65)*size);this.dot.setAttribute('fill',p.reticleColor);this.dot.style.display=p.reticleDot||p.reticleStyle==='dot'||p.reticleStyle==='crossdot'?'':'none';this.ring.style.display=shape==='circle'?'':'none';this.ring.setAttribute('r',p.reticleDiameter*size/2+cone);this.ring.setAttribute('stroke',p.reticleColor);this.ring.setAttribute('stroke-width',p.reticleWidth*size);this.el.style.opacity=p.reticleOpacity;}
}
