import {runHUDChecks as runOriginalHUDChecks} from './verify-hud.js';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function runHUDChecks(q){
 const original=await runOriginalHUDChecks(q),results=[...original.results];const test=(name,fn)=>{try{const detail=fn();results.push({name,passed:true,detail:detail||'OK'});}catch(e){results.push({name,passed:false,detail:e.message});}};
 const {editor,input,player,match}=q;document.getElementById('customize-hud').click();const p=JSON.stringify([player.x,player.y,player.z,player.vx,player.vz,input.yaw]),time=match.time;
 test('V3 HUD · Vida, escudo, puntuación y partida editables',()=>{for(const id of ['health-bar','shield-bar','score-bar','match-status'])assert(editor.items.some(i=>i.id===id),'Falta '+id);});
 const selected=editor.items.find(i=>i.id==='health-bar');editor.select(selected);const draft=JSON.stringify(editor.store.current);document.getElementById('hud-collapse').click();await wait(230);
 test('V3 HUD · Plegar conserva selección y edición',()=>{assert(editor.bar.classList.contains('collapsed')&&editor.editing&&editor.selected===selected&&!input.active,'Estado alterado');assert(JSON.stringify(editor.store.current)===draft,'Se perdió borrador');const r=document.getElementById('hud-collapse').getBoundingClientRect();assert(r.bottom>0&&r.height>=24,'Pestaña inaccesible');});
 test('V3 HUD · Editar barra vital con panel plegado',()=>{editor.set(selected,{x:.28,y:.75,scale:1.25,opacity:.55});assert(Math.abs(editor.value(selected).scale-1.25)<.01,'Escalado no aplicado');});
 document.getElementById('hud-collapse').click();await wait(230);
 test('V3 HUD · Reabrir mantiene perspectiva y reloj',()=>{assert(editor.selected===selected&&p===JSON.stringify([player.x,player.y,player.z,player.vx,player.vz,input.yaw])&&match.time===time,'Simulación avanzó');});
 document.getElementById('hud-cancel').click();
 test('V3 Retícula · Círculo fino con diámetro real',()=>{const saved={...q.preferences};Object.assign(q.preferences,{reticleStyle:'circle',reticleDiameter:24,reticleSize:1,reticleWidth:1,reticleDynamic:false});q.reticle.update(0,60,390);assert(q.reticle.ring.getAttribute('r')==='12'&&q.reticle.ring.getAttribute('stroke-width')==='1','Diámetro/grosor incorrectos');Object.assign(q.preferences,saved);q.reticle.update(0,60,390);});
 test('V3 HUD · Auto recarga dentro del indicador',()=>assert(document.querySelector('.weapon-info #auto-reload'),'Interruptor fuera de munición'));
 const responsive=[];
 for(const [width,height]of [[844,390],[390,844]]){
  const iframe=document.createElement('iframe');iframe.style.cssText=`position:fixed;left:0;top:0;width:${width}px;height:${height}px;border:0;z-index:60`;iframe.src='./index.html?qa=1&responsive='+width;document.body.append(iframe);await new Promise(resolve=>iframe.onload=resolve);
  for(let i=0;i<80&&!iframe.contentWindow.kineticQA;i++)await wait(25);
  const child=iframe.contentWindow.kineticQA,doc=iframe.contentDocument;
  test(`V3 UI ${width}×${height} · Inicia sin errores`,()=>assert(child,'No inició la página'));
  if(child){doc.getElementById('qa-run').hidden=true;child.input.touchMode=true;doc.body.classList.add('touch');await child.start();child.match.player.spawnUntil=Infinity;
   test(`V3 UI ${width}×${height} · Tres ranuras reciben el toque real`,()=>{for(let i=0;i<3;i++){const b=doc.querySelector('[data-action="slot'+i+'"]'),r=b.getBoundingClientRect(),hit=doc.elementFromPoint(r.x+r.width/2,r.y+r.height/2);assert(hit?.closest('[data-action]')===b,'Capa superpuesta sobre ranura '+i+': '+hit?.id);b.dispatchEvent(new iframe.contentWindow.PointerEvent('pointerdown',{pointerId:70+i,pointerType:'touch',bubbles:true,cancelable:true}));b.dispatchEvent(new iframe.contentWindow.PointerEvent('pointerup',{pointerId:70+i,pointerType:'touch',bubbles:true}));const actions=child.input.sample().actions;assert(actions.includes('slot'+i),'Evento de ranura perdido');child.arsenal.select(i);assert(child.arsenal.selected===i,'Arma no cambia');}});
   child.pause();doc.getElementById('customize-hud').click();
   test(`V3 UI ${width}×${height} · Áreas seguras y perfiles`,()=>{const safe=child.editor.safeRect();for(const item of child.editor.items){const r=item.shell.getBoundingClientRect();assert(r.left>=safe.x-.5&&r.right<=safe.x+safe.w+.5&&r.top>=safe.y-.5&&r.bottom<=safe.y+safe.h+.5,'Elemento fuera de pantalla: '+item.id);}assert(child.editor.mode===(width>height?'landscape':'portrait'),'Perfil equivocado');});
   responsive.push({width,height,mode:child.editor.mode});child.editor.close(false);
  }iframe.remove();
 }
 q.pause();return{...original,measurements:{...original.measurements,responsive,scope:'DOM real en Chrome, iframes de dimensiones CSS; no Safari ni dispositivo emulado'},results,passed:results.filter(r=>r.passed).length,total:results.length};
}
