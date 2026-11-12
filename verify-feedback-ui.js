import {runCombatHUDChecks} from './verify-combat-ui.js';
const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw Error(m);};
export async function runFeedbackHUDChecks(q){
 const base=await runCombatHUDChecks(q),results=base.results.slice(),{match:m,input,arsenal,preferences,player:p,view,combatUI}=q,saved={...preferences};
 const advance=async ms=>{q.advance(Math.ceil(ms/1000*60));await wait(0);};
 const test=(name,fn)=>{try{results.push({name,passed:true,detail:fn()||'OK'});}catch(e){results.push({name,passed:false,detail:e.message});}};
 const freeze=()=>{for(const b of m.bots){b.nextDecision=Infinity;b.path=[];b.target=null;b.memory=null;b.input.x=b.input.z=0;b.body.vx=b.body.vz=0;b.spawnUntil=Infinity;}};
 q.beginSimulation({mode:'training',bots:1});input.touchMode=true;await q.start();freeze();await advance(20);m.player.spawnUntil=Infinity;input.clear();preferences.autoFire=false;preferences.autoInteract=false;
 test('Respuesta HUD · Intensidad 4× y alcance 110 m disponibles',()=>{assert($('v2-assistStrength').max==='4'&&$('v2-assistRange').max==='110','Límites de controles');assert($('assistTracking')&&$('autoInteract'),'Faltan opciones');});
 $('autoInteract').checked=true;$('autoInteract').dispatchEvent(new Event('change',{bubbles:true}));
 test('Respuesta HUD · Autoabrir se activa y persiste sin reiniciar',()=>assert(preferences.autoInteract&&JSON.parse(localStorage.getItem('kinetic-preferences-v2')).autoInteract,'No persiste'));
 const c=m.crates[0];p.reset({x:c.x,y:c.y,z:c.z+2.2});view.eye=1.67;input.yaw=0;input.pitch=Math.atan2(.7-view.eye,2.2);combatUI.nextCrate=0;await advance(450);
 test('Autoabrir integrado · La mirada inicia el anillo real',()=>assert(c.available&&m.player.opening?.progress>.35&&m.player.opening.progress<.7&&+combatUI.ring.style.strokeDashoffset<70,'No avanza con la mirada'));
 input.yaw=Math.PI/2;await advance(60);
 test('Autoabrir integrado · Apartar mirada cancela sin abrir',()=>assert(c.available&&!m.player.opening,'No cancela'));
 input.yaw=0;await advance(1150);
 test('Autoabrir integrado · Completar abre tapa y crea botín',()=>assert(!c.available&&c.lid===1&&c.visual.lid.rotation.x===1.88&&m.supplies.drops.some(d=>d.crate===c.id&&d.active),'No abre y entrega'));
 preferences.autoInteract=false;m.player.health=75;m.player.shield=20;m.player.inventory.mini=3;input.actions.push('mini');await advance(250);
 test('Viñeta integrada · Mini azul visible y separada de controles',()=>{const el=$('heal-feedback');assert(m.player.consuming?.kind==='mini'&&+el.style.opacity>.6&&el.classList.contains('mini'),'No se ve la mini');assert(el.parentElement===$('scene-feedback')&&!$('hud').contains(el),'Viñeta dentro del HUD');assert(getComputedStyle(el).backgroundImage.includes('185, 250'),'Gradiente débil o equivocado');assert(getComputedStyle($('scene-feedback')).pointerEvents==='none','Bloquea interacción');});
 const samples=[];for(let i=0;i<6;i++){await advance(150);samples.push(+$('heal-feedback').style.opacity);}
 test('Viñeta integrada · Respiración continua durante consumo de 2 s',()=>assert(Math.min(...samples)>.61&&Math.max(...samples)-Math.min(...samples)>.1,'Pulso invisible o apagado'));
 await advance(1400);
 test('Viñeta integrada · Final cura y desvanece',()=>assert(m.player.shield===45&&!m.player.consuming&&+$('heal-feedback').style.opacity===0,'Curación/salida incorrecta'));
 m.player.lastDamage=m.time;combatUI.frame(1/60);
 test('Viñeta integrada · Daño reforzado conserva centro y controles',()=>assert(+$('damage-feedback').style.opacity>.8&&getComputedStyle($('hud')).filter==='none','Daño o filtro incorrecto'));

 // Isolate clock values for the feed: four persistent rows, timed by visible age.
 combatUI.feed.reset();const event=i=>({type:'elimination',actor:1,killer:0,killerName:'AZUL '+i,victimName:'ROJO '+i,killerTeam:'blue',victimTeam:'red',weapon:'rifle'});
 const at=m.time;for(let i=0;i<8;i++)combatUI.onEvent(event(i));combatUI.updateFeed(at,false);combatUI.updateFeed(at+.2,false);
 test('Cola HUD · Ocho bajas muestran cuatro y encolan cuatro',()=>assert(combatUI.rows.filter(r=>!r.el.hidden).length===4&&combatUI.feed.pending.length-combatUI.feed.head===4,'Sobrescribe filas'));
 combatUI.updateFeed(at+2.99,false);
 test('Cola HUD · Cada baja permanece tres segundos completos',()=>assert(combatUI.rows.every(r=>+r.el.style.opacity>.99)&&combatUI.feed.active[0].victim==='ROJO 0','Desaparece antes'));
 combatUI.updateFeed(at+3.12,false);
 test('Cola HUD · Desaparición gradual antes de avanzar la cola',()=>assert(combatUI.rows.every(r=>+r.el.style.opacity>0&&+r.el.style.opacity<1),'Salida brusca'));
 combatUI.updateFeed(at+3.25,false);combatUI.updateFeed(at+3.5,false);
 test('Cola HUD · Pendientes nuevos tienen temporizador propio',()=>assert(combatUI.feed.active.map(e=>e.victim).join(',')==='ROJO 4,ROJO 5,ROJO 6,ROJO 7'&&combatUI.rows.every(r=>!r.el.hidden&&+r.el.style.opacity===1),'Pierde pendientes'));
 test('Cola HUD · Cuatro filas caben y mantienen colores/orden',()=>{const heights=combatUI.rows.map(r=>r.el.getBoundingClientRect().height);assert(heights.every(h=>h>0&&h<=18.1),'Filas desbordan');assert(new Set(combatUI.rows.map(r=>r.el.style.top)).size===4,'Filas superpuestas');assert(combatUI.rows.every(r=>r.killer.classList.contains('name-blue')&&r.victim.classList.contains('name-red')),'Colores');assert(getComputedStyle(combatUI.rows[0].el).transitionProperty.includes('top'),'No anima desplazamiento');});
 combatUI.feed.reset();combatUI.updateFeed(m.time,false);

 m.player.spawnUntil=0;m.damage(m.player,1000,m.bots[0],'rifle');await advance(580);await wait(280);
 test('Muerte integrada · Mensaje rojo y cuenta blanca sin recuadro',()=>{assert(!m.player.alive&&!$('death-feedback').hidden&&$('death-title').textContent.length>5,'Sin pantalla de muerte');assert($('death-countdown').textContent.includes('REAPARICIÓN EN'),'Sin cuenta');const style=getComputedStyle($('death-feedback'));assert(style.backgroundColor==='rgba(0, 0, 0, 0)'&&style.borderTopWidth==='0px','Conserva recuadro');});
 test('Muerte integrada · Blur solo escena, viñetas negras y rojas',()=>{assert(document.body.classList.contains('player-dead')&&getComputedStyle($('game')).filter.includes('blur('),'No difumina escena');assert(getComputedStyle($('hud')).filter==='none'&&getComputedStyle(document.querySelector('.weapon-info')).filter==='none','Difumina controles');assert(+$('death-black').style.opacity>.9&&+$('death-red').style.opacity>.8,'Viñeta débil');});
 const phrase=$('death-title').textContent;m.time=m.player.deadUntil-.02;await advance(400);await wait(280);
 test('Muerte integrada · Reaparición retira efectos suavemente',()=>assert(m.player.alive&&!document.body.classList.contains('player-dead')&&$('death-feedback').hidden&&+$('death-black').style.opacity===0&&getComputedStyle($('game')).filter==='none','Efectos persisten'));
 m.player.spawnUntil=0;m.damage(m.player,1000,m.bots[0],'shotgun');await advance(500);
 test('Muerte integrada · Siguiente eliminación cambia frase',()=>assert($('death-title').textContent!==phrase,'Frase consecutiva repetida'));
 const count=document.querySelectorAll('*').length;for(let i=0;i<120;i++)combatUI.frame(1/60);
 test('Respuesta HUD · Efectos reutilizan nodos sin crecimiento DOM',()=>assert(document.querySelectorAll('*').length===count,'Crea nodos por cuadro'));
 Object.assign(preferences,saved);try{localStorage.setItem('kinetic-preferences-v2',JSON.stringify(saved));}catch{}q.pause();
 return{measurements:base.measurements,passed:results.filter(r=>r.passed).length,total:results.length,results};
}
