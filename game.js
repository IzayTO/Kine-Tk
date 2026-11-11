import {DEFAULTS,Player,CollisionWorld,FixedClock,clamp} from './physics.js';
import {createLevel} from './level.js';
import {V3World} from './world-v3.js';
import {Match,MATCH_DEFAULTS} from './match.js';
import {Arsenal} from './combat.js';
import {HUDEditor,Minimap,Reticle} from './hud.js';
import {loadPreferences,savePreferences,assistDelta} from './preferences.js';
import {setupV2Settings} from './settings-v2.js';
import {refineLevel} from './refinements.js';
import {Input} from './input.js';
import {AudioFX} from './audio.js';

const $=id=>document.getElementById(id),canvas=$('game');
const settingsKey='kinetic-fps-settings-v1';
const controls=[
 ['walkSpeed','Velocidad al caminar',1,7,0.1,'m/s'],['runSpeed','Carrera normal',4,10,0.1,'m/s'],
 ['sprintSpeed','Velocidad de sprint',8,16,0.1,'m/s'],['acceleration','Aceleración',15,85,1,'m/s²'],
 ['friction','Fricción / frenado',2,15,0.1,'s⁻¹'],['jumpSpeed','Impulso de salto',4,12,0.1,'m/s'],
 ['gravity','Gravedad',12,38,0.5,'m/s²'],['slideBoost','Impulso del deslizamiento',0,5,0.1,'m/s'],
 ['slideDuration','Duración máxima del slide',0.4,2.4,0.05,'s'],['slideDrag','Desaceleración del slide',1,10,0.1,'m/s²'],
 ['airControl','Control aéreo',0,0.8,0.01,'×'],['sensitivity','Sensibilidad',0.25,2.5,0.05,'×'],
 ['hFov','Campo de visión horizontal',75,120,1,'°'],['cameraMotion','Movimiento de cámara',0,1.5,0.05,'×'],
 ['recoil','Retroceso visual',0,1.5,0.05,'×'],['resolution','Escala de resolución',0.55,1.25,0.05,'×']
];
const params={...DEFAULTS};
try{
  const saved=JSON.parse(localStorage.getItem(settingsKey)||'null');
  if(saved){for(const [key,,min,max]of controls)if(Number.isFinite(saved[key]))params[key]=clamp(saved[key],min,max);
    for(const key of ['autoSprint','autoResolution','contextualSlide','sound'])if(typeof saved[key]==='boolean')params[key]=saved[key];}
}catch{}
const saveSettings=()=>{try{localStorage.setItem(settingsKey,JSON.stringify(params));}catch{}};
let playing=false,started=false,view,input,player,level,clock,frame=0,lastTime=0;
let fps=60,frameCount=0,frameSum=0,hudTime=0,hitTimer=0,hits=0,shots=0,playTime=0,footDistance=0,autoTime=0;
const audio=new AudioFX(params),preferences=loadPreferences(),arsenal=new Arsenal();
// Explicit diagnostic mode does not pretend to render a game. Normal startup always requires WebGL.
const diagnostic=new URLSearchParams(location.search).has('qa');
let editor,minimap,reticle,refreshV2,assistCache=null,assistTime=0,match;
let matchConfig={...MATCH_DEFAULTS};try{const saved=JSON.parse(localStorage.getItem('kinetic-match-v3'));if(saved)Object.assign(matchConfig,saved);}catch{}
audio.preferences=preferences;arsenal.autoReload=preferences.autoReload;
const events=[],metrics={physicsMS:0,renderMS:0,hudMS:0,minimapMS:0,physicsSteps:0};

function toast(message){$('toast').textContent=message;$('toast').style.opacity='1';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.opacity='0',2200);}
function tab(name){for(const button of document.querySelectorAll('[data-tab]'))button.classList.toggle('active',button.dataset.tab===name);for(const id of ['settings','map','controls','reticle','match','audio'])$('tab-'+id).hidden=id!==name;if(name==='map')drawMap($('pause-map'),true);}
function pause(settings=false){
  if(editor?.editing){editor.close(false);return;}if(!started)return;playing=false;input.active=false;input.clear();clock.reset();audio.suspend();
  $('pause').hidden=false;$('touch-controls').hidden=true;$('hud').hidden=true;
  if(document.pointerLockElement)document.exitPointerLock();if(settings)tab('settings');
}
async function start(){
  if(!view||editor?.editing)return;
  if((!started||match.ended)&&!match.running)beginSimulation();
  audio.unlock();audio.ambient();
  if(!input.touchMode&&!diagnostic){
    try{
      const lock=canvas.requestPointerLock();if(lock&&typeof lock.then==='function')await lock;
    }catch{
      if(!started)$('start-help').textContent='Haz clic de nuevo para capturar el cursor. Abre la página directamente, fuera de visores incrustados.';
      else document.querySelector('.settings-note').textContent='Vuelve a pulsar CONTINUAR para capturar el cursor.';
      return;
    }
  }
  playing=true;started=true;input.active=true;input.clear();clock.reset();lastTime=performance.now();frameCount=0;frameSum=0;autoTime=0;
  $('welcome').hidden=true;$('pause').hidden=true;$('match-result').hidden=true;$('hud').hidden=false;$('touch-controls').hidden=!input.touchMode;
  // Fullscreen is optional. Safari can play directly in the normal viewport.
  if(!diagnostic&&input.touchMode&&!document.fullscreenElement&&document.documentElement.requestFullscreen){try{await document.documentElement.requestFullscreen();}catch{}}
}
function reset(){player.reset();input.clear();input.yaw=level.spawn.yaw;input.pitch=0;view.eye=1.67;view.landing=0;view.recoil=0;clock.reset();toast('Punto de inicio restablecido');}
function drawMap(container,withPlayer){
  if(!level)return;let shapes='';
  for(const v of level.visuals){
    if(v.id==='ground'||v.id==='route'||v.id.includes('lip')||v.id.includes('fascia')||v.id.includes('trim')||v.id.includes('rib'))continue;
    const fill=['teal','coral','yellow'].includes(v.mat)?({teal:'#67c7ad',coral:'#b56f59',yellow:'#bdab76'}[v.mat]):v.mat==='asphalt'?'#314b53':'#4b666b';
    if(v.type==='box')shapes+=`<rect x="${v.x-v.w/2}" y="${v.z-v.d/2}" width="${v.w}" height="${v.d}" fill="${fill}" stroke="#98b8af" stroke-opacity=".2" stroke-width=".12" transform="rotate(${v.angle*180/Math.PI} ${v.x} ${v.z})"/>`;
    else shapes+=`<polygon points="${v.poly.map(p=>p.join(',')).join(' ')}" fill="${fill}" stroke="#b1d4c2" stroke-opacity=".35" stroke-width=".2"/>`;
  }
  const path='M0 39 L-3 23 L-3 9 L-3 -8 L25 -8 L25 2 L14 2 L14 18 L14 30 L43 30 L43 -19 L11 -19 L11 -35 L-17 -35 L-17 -21 L-34 -21 L-34 -12 L-29 -10 L-16 -10 L-16 20 L-3 20 L0 39';
  const x=withPlayer?player.x:0,z=withPlayer?player.z:39,yaw=withPlayer?input.yaw:0;
  container.innerHTML=`<svg viewBox="-53 -53 106 106" role="img" aria-label="Plano de las seis zonas de NODO 09"><defs><pattern id="grid-${withPlayer?'p':'w'}" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#92b4ae" stroke-opacity=".12" stroke-width=".15"/></pattern></defs><rect x="-50" y="-50" width="100" height="100" fill="url(#grid-${withPlayer?'p':'w'})"/>${shapes}<path d="${path}" fill="none" stroke="#91e7be" stroke-width=".65" stroke-dasharray="1.8 1.4" opacity=".8"/>${[[0,30,'01'],[-30,-1,'02'],[28,11,'03'],[3,-31,'04'],[43,0,'05'],[0,-15,'06']].map(([a,b,t])=>`<circle cx="${a}" cy="${b}" r="3.2" fill="#203b43"/><text x="${a}" y="${b+1.1}" text-anchor="middle" font-family="Arial" font-size="3" fill="#dce9d5">${t}</text>`).join('')}<g transform="translate(${x} ${z}) rotate(${-yaw*180/Math.PI})"><circle r="3.4" fill="#8ff6d3" fill-opacity=".15"/><path d="M0 -2.8L1.8 2L0 1L-1.8 2Z" fill="#b5ffe0"/></g></svg>`;
}
function setupSettings(){
  for(const [key,title,min,max,step,unit]of controls){
    const wrap=document.createElement('div');wrap.className='setting';
    wrap.innerHTML=`<label for="setting-${key}">${title}<output id="value-${key}" for="setting-${key}"></output></label><input id="setting-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${params[key]}">`;
    $('sliders').append(wrap);
    const el=$('setting-'+key);el.addEventListener('input',()=>{params[key]=Number(el.value);refreshSettings();saveSettings();if(key==='resolution')view?.resize(innerWidth,innerHeight,true);});
  }
  for(const key of ['autoSprint','autoResolution','contextualSlide','sound'])$(key).addEventListener('change',()=>{params[key]=$(key).checked;if(key==='autoResolution'&&!params[key]){view.dynamicScale=1;view.resize(innerWidth,innerHeight,true);}saveSettings();});
  $('defaults').addEventListener('click',()=>{Object.assign(params,DEFAULTS);view.dynamicScale=1;refreshSettings();view.resize(innerWidth,innerHeight,true);saveSettings();});
  refreshSettings();
}
function refreshSettings(){
  for(const [key,,,max,step,unit]of controls){$('setting-'+key).value=params[key];$('value-'+key).textContent=(step>=1?params[key].toFixed(0):params[key].toFixed(step===0.01||step===0.05?2:1))+' '+unit;}
  for(const key of ['autoSprint','autoResolution','contextualSlide','sound'])$(key).checked=params[key];
}
function tick(now){
  frame=requestAnimationFrame(tick);const rawDt=Math.max(0,(now-lastTime)/1000||0),dt=Math.min(rawDt,0.1);lastTime=now;
  let alpha=1;
  if(playing){
    const physicsStart=performance.now();let steps=0;
    playTime+=dt;input.speed=player.speed;
    alpha=clock.advance(dt,h=>{
      const wasSlide=player.sliding,wasSpeed=player.speed,sample=input.sample(true);
      match.player.yaw=input.yaw;match.player.pitch=input.pitch;
      if(match.player.alive)player.step(h,sample);steps++;
      for(const action of (match.player.alive?sample.actions:[])){
        if(action.startsWith('slot')){if(arsenal.select(+action.slice(4)))audio.sound('switch');}
        else if(action==='reload'){if(arsenal.requestReload())audio.sound('reload');}
        else if(action==='mode')arsenal.toggleMode();
        else if(action==='assist'){preferences.assist=!preferences.assist;savePreferences(preferences);refreshV2();}
        else if(action==='ping')events.push({type:'ping'});
      }
      if(match.player.alive)arsenal.step(h,sample,{speed:player.speed,grounded:player.grounded,aim:sample.aim&&arsenal.selected!==0},e=>events.push(e));
      match.step(h);
      if(match.player.alive){if(player.jumpEvent){view.onJump();audio.sound('jump');}if(player.landEvent){view.onLand(player.landImpact);if(player.landImpact>4){audio.sound('land');match.hear(match.player,15,'land');}}
      if(!wasSlide&&player.sliding)audio.sound('slide');if(wasSpeed>6&&player.speed<wasSpeed-2&&player.grounded)audio.sound('brake');
      if(player.grounded&&!player.sliding&&player.speed>1.5){footDistance+=player.speed*h;if(footDistance>2.6){footDistance=0;audio.sound(player.speed>9?'sprint':'step');if(player.speed>9)match.hear(match.player,13,'sprint');}}}
    });
    metrics.physicsMS=performance.now()-physicsStart;metrics.physicsSteps=steps;
    audio.setListener(player,input.yaw);const sampled=input.sample(false);view.update(dt,player,sampled,alpha,arsenal);
    for(const event of events){
      if(event.type==='ping'){if(!view.placePing())toast('No hay una superficie válida en esa dirección');continue;}
      if(event.type==='empty'){toast('Sin munición · Recarga');continue;}
      if(event.type==='loaded'||event.type==='shell'||event.type==='reload'||event.type==='pump'){audio.sound(event.type);continue;}
      if(event.type==='swing'){audio.sound('swing');continue;}
      const result=event.type==='shot'?view.fire(event):event.type==='melee'?view.melee():[];
      if(event.type==='shot'){shots++;}
      if(result.length){hits+=result.length;hitTimer=.12;audio.sound('hit');$('hits').textContent=String(hits).padStart(2,'0');}
    }events.length=0;
    processMatchEvents();
    $('damage-feedback').style.opacity=match.player.hit>0?'.8':'0';$('death-feedback').hidden=match.player.alive;if(!match.player.alive)$('death-feedback').textContent='ELIMINADO · REAPARICIÓN EN '+Math.max(0,match.player.deadUntil-match.time).toFixed(1)+' s';
    if(match.config.quality==='adaptive')match.qualityScale=fps<46?1.5:1;
    assistTime+=dt;if(assistTime>=.08){assistTime=0;assistCache=preferences.assist?view.assistTarget(input.yaw,input.pitch,preferences):null;}
    reticle.update(arsenal.spread({speed:player.speed,grounded:player.grounded,aim:sampled.aim}),view.camera.fov,innerHeight);
    $('reticle').classList.toggle('aim',sampled.aim);input.lookDX=0;input.lookDY=0;
    hitTimer=Math.max(0,hitTimer-dt);$('hitmarker').style.opacity=hitTimer>0?'1':'0';
    $('chain-hint').style.opacity=playTime>18?'0':'1';
  }else if(!started&&!editor?.editing){
    view.update(dt,player,{yaw:0,pitch:0.01,x:0},1);
  }
  // Project the fixed world marker on EVERY rendered frame; digits remain low-frequency.
  const projected=view.pingScreen();$('ping-readout').hidden=!projected?.visible;if(projected?.visible)$('ping-readout').style.transform=`translate(-50%,-110%) translate(${projected.x}px,${projected.y}px)`;
  // Render while paused at 30 Hz, reducing battery use without hiding the environment.
  if(playing||frameCount%2===0){const renderStart=performance.now();view.render();metrics.renderMS=diagnostic?0:performance.now()-renderStart;}
  frameCount++;frameSum+=rawDt;hudTime+=dt;if(playing)autoTime+=dt;
  if(frameSum>=0.5){fps=frameCount/frameSum;frameCount=0;frameSum=0;}
  if(hudTime>=0.12){
    const hudStart=performance.now();hudTime=0;$('fps').textContent=String(Math.round(fps));$('speed').textContent=player.speed.toFixed(1);$('state').textContent=player.state;
    $('ground').textContent=player.grounded?'● SUELO':'○ AIRE';$('speed-fill').style.width=Math.min(100,player.speed/18*100)+'%';
    const zone=level.zones.find(z=>Math.abs(player.x-z.x)<z.w/2&&Math.abs(player.z-z.z)<z.d/2);$('zone').textContent=zone?.name||'ENLACE EXTERIOR';
    minimap.update(now/1000,player,input.yaw,view.pingPosition,preferences.mapRotate);metrics.minimapMS=minimap.ms;document.querySelector('#minimap>span').textContent=preferences.mapRotate?'RUMBO / 09':'N ↑ / 09';
    const ping=view.pingScreen();$('ping-readout').hidden=!ping?.visible;if(ping?.visible){$('ping-readout').style.left='0';$('ping-readout').style.top='0';$('ping-readout').textContent='◇ '+Math.round(ping.distance)+' m';}
    $('ammo').textContent=arsenal.selected===0?'—':arsenal.ammo;$('weapon-name').textContent=arsenal.weapon.name;
    $('fire-mode').textContent=arsenal.selected===1?arsenal.mode.toUpperCase():arsenal.selected===2?(arsenal.shotgunMode==='pump'?'CORREDERA':'TÁCTICO'):'CUCHILLO';
    $('ammo-status').textContent=arsenal.reload?'RECARGANDO':arsenal.selected===0?'AGARRE INVERTIDO':'/ '+arsenal.weapon.capacity+' · RESERVA '+arsenal.reserve;
    $('reload-progress').style.width=(arsenal.reloadProgress*100)+'%';
    document.querySelectorAll('#weapon-slots button').forEach((b,i)=>b.classList.toggle('selected',i===arsenal.selected));
    document.querySelector('.assist-button').classList.toggle('selected',preferences.assist);
    document.querySelector('.mode-button').classList.toggle('selected',arsenal.selected===1&&arsenal.mode==='semi');document.querySelector('.mode-button small').textContent=arsenal.selected===1?arsenal.mode.toUpperCase():arsenal.selected===2?(arsenal.shotgunMode==='pump'?'BOMBA':'TÁCTICO'):'FILO';
    updateMatchHUD();
    metrics.hudMS=performance.now()-hudStart;
    $('render-stats').textContent=`120 Hz · ${view.stats.calls} llamadas · ${Math.round(view.stats.triangles/1000)}k triángulos · ${Math.round(view.scale*100)}% píxel CSS · CPU física ${metrics.physicsMS.toFixed(2)} ms · envío render ${metrics.renderMS.toFixed(2)} ms · HUD ${metrics.hudMS.toFixed(2)} ms${diagnostic?' · QA SIN 3D':''}`;
  }
  if(autoTime>3&&playing&&params.autoResolution&&!diagnostic){autoTime=0;
    const next=fps<49?Math.max(0.62,view.dynamicScale-0.08):fps>58?Math.min(1,view.dynamicScale+0.035):view.dynamicScale;
    if(next!==view.dynamicScale){view.dynamicScale=next;view.resize(innerWidth,innerHeight,true);}
  }
}
function beginSimulation(config=matchConfig){
 match.start(config);view.attachMatch(match);player.previous={x:player.x,y:player.y,z:player.z};input.yaw=match.player.yaw;input.pitch=0;input.clear();clock.reset();events.length=0;arsenal.autoReload=preferences.autoReload;view.eye=1.67;view.landing=0;playTime=0;hits=shots=0;$('hits').textContent='00';$('match-result').hidden=true;$('death-feedback').hidden=true;updateMatchHUD();
}
function processMatchEvents(){
 for(const e of match.events){
  const local=e.actor===0,pos=local?null:e.position;
  if(e.type==='trace'){view.showTrace(e);if(Math.hypot(e.to.x-player.x,e.to.y-player.y,e.to.z-player.z)<12)audio.sound('hit',e.to);continue;}
  if(e.type==='shot'){audio.sound(e.weapon,pos);continue;}
  if(e.type==='spawn'&&local){input.clear();input.yaw=match.player.yaw;input.pitch=0;input.active=playing;view.eye=1.67;view.landing=0;}
  if(e.type==='elimination'&&local){input.clear();input.active=false;player.jumpEvent=player.landEvent=false;}
  if(e.type==='finished'){playing=false;input.active=false;input.clear();if(document.pointerLockElement)document.exitPointerLock();$('pause').hidden=true;$('hud').hidden=true;$('touch-controls').hidden=true;showResult();continue;}
  if(e.type==='melee')continue;audio.sound(e.type,pos);
 }match.events.length=0;
}
function updateMatchHUD(){
 if(!match)return;const a=match.player;$('health-value').textContent=Math.ceil(a.health);$('shield-value').textContent=Math.ceil(a.shield);$('health-fill').style.width=a.health+'%';$('shield-fill').style.width=a.shield+'%';$('score-blue').textContent=match.config.mode==='ffa'?a.kills:match.score?.blue||0;$('score-red').textContent=match.config.mode==='ffa'?a.deaths:match.score?.red||0;
 $('score-label-blue').textContent=match.config.mode==='ffa'?'BAJAS':'AZUL';$('score-label-red').textContent=match.config.mode==='ffa'?'CAÍDAS':'ROJO';
 const left=Math.max(0,match.config.minutes*60-match.time),time=Math.floor(left/60)+':'+String(Math.floor(left%60)).padStart(2,'0');$('match-status').textContent=(match.config.mode==='training'?'ENTRENAMIENTO':match.config.mode==='ffa'?'LIBRE · '+time:'EQUIPOS · '+time)+(a.alive&&match.time<a.spawnUntil?' · PROTEGIDO':'');
 $('auto-reload').textContent='AUTO RECARGA: '+(preferences.autoReload?'ON':'OFF');$('auto-reload').setAttribute('aria-pressed',String(preferences.autoReload));
}
function openMatchMenu(){playing=false;input.active=false;input.clear();clock.reset();if(document.pointerLockElement)document.exitPointerLock();$('welcome').hidden=true;$('hud').hidden=true;$('touch-controls').hidden=true;$('pause').hidden=false;$('match-result').hidden=true;tab('match');}
function showResult(){const r=match.result;$('result-title').textContent='GANADOR · '+r.winner;const table=document.createElement('table'),head=document.createElement('tr');for(const name of ['PARTICIPANTE','BAJAS','CAÍDAS']){const th=document.createElement('th');th.textContent=name;head.append(th);}table.append(head);for(const a of r.ranked){const row=document.createElement('tr');for(const value of [a.name,a.kills,a.deaths]){const td=document.createElement('td');td.textContent=value;row.append(td);}table.append(row);}$('result-scores').replaceChildren(table);$('match-result').hidden=false;}
function setupMatchUI(){
 const fields=['mode','bots','difficulty','team','minutes','limit','quality','crateSeconds'];for(const key of fields){const el=$('match-'+key);el.value=String(matchConfig[key]);if(!el.value)el.value=String(MATCH_DEFAULTS[key]);}
 const refresh=()=>{const n=+$('match-bots').value;$('bot-count-label').textContent=n;$('bot-warning').textContent=n>=12?n+' bots · Mayor carga de CPU. Reduce la cantidad o usa IA adaptativa si baja la fluidez.':n+' bots · Perfiles y percepción activos.';};$('match-bots').oninput=refresh;refresh();
 const read=()=>{for(const key of fields){const val=$('match-'+key).value;matchConfig[key]=typeof MATCH_DEFAULTS[key]==='number'?+val:val;}try{localStorage.setItem('kinetic-match-v3',JSON.stringify(matchConfig));}catch{}return matchConfig;};
 $('configure-match').onclick=openMatchMenu;$('begin-match').onclick=()=>{beginSimulation(read());start();};$('restart-match').onclick=()=>{beginSimulation(read());start();};$('result-restart').onclick=()=>{beginSimulation();start();};$('result-menu').onclick=openMatchMenu;
 $('return-menu').onclick=()=>{playing=false;started=false;match.running=false;input.active=false;input.clear();$('pause').hidden=true;$('welcome').hidden=false;$('hud').hidden=true;$('touch-controls').hidden=true;};
 $('auto-reload').onclick=e=>{if(editor.editing)return;e.stopPropagation();preferences.autoReload=!preferences.autoReload;arsenal.autoReload=preferences.autoReload;savePreferences(preferences);updateMatchHUD();};
}
try{
  level=refineLevel(createLevel());player=new Player(new CollisionWorld(level.solids),params,level.spawn);clock=new FixedClock();
  match=new Match(player.world,player,arsenal,params);view=new V3World(canvas,level,params,{render:!diagnostic});input=new Input(canvas,params,pause,reset);
  input.preferences=preferences;input.onAssist=(yaw,pitch,dyaw,dpitch)=>assistDelta(yaw,pitch,dyaw,dpitch,view.confirmAssist(assistCache),preferences);
  editor=new HUDEditor({touch:input.touchMode,onClose:({save,persisted})=>{input.clear();clock.reset();$('pause').hidden=false;$('touch-controls').hidden=true;$('hud').hidden=true;tab('controls');if(save)toast(persisted?'Distribución guardada':'Aplicada en esta sesión; almacenamiento no disponible');}});
  minimap=new Minimap($('minimap-canvas'),level);reticle=new Reticle($('reticle'),preferences);refreshV2=setupV2Settings(preferences,()=>reticle.update(0,view.camera.fov,innerHeight));
  $('customize-hud').onclick=()=>{playing=false;input.active=false;input.clear();clock.reset();$('pause').hidden=true;$('hud').hidden=false;$('touch-controls').hidden=false;editor.begin();};
  $('reset-targets').onclick=()=>{beginSimulation();toast('Partida reiniciada');};
  setupMatchUI();
  if(diagnostic){const flag=document.createElement('div');flag.className='qa-flag';flag.textContent='QA · SIN RENDERIZADO 3D';document.body.append(flag);}

  setupSettings();drawMap($('welcome-map'),false);
  if(input.touchMode)$('start-help').textContent='Joystick · Mirada táctil · Botones simultáneos';
  view.resize(innerWidth,innerHeight,true);
  window.addEventListener('resize',()=>{view.resize(innerWidth,innerHeight,true);input.clear();clock.reset();});
  window.visualViewport?.addEventListener('resize',()=>view.resize(innerWidth,innerHeight));
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('fatal-text').textContent='El navegador liberó el contexto gráfico. Recarga para volver al punto inicial; tus ajustes se conservarán.';$('fatal').hidden=false;});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  document.addEventListener('pointerlockerror',()=>{if(started)pause();else $('start-help').textContent='Vuelve a pulsar INICIAR para permitir la captura del mouse.';});
  $('start').disabled=false;$('load-status').hidden=true;
  $('start').addEventListener('click',start);$('resume').addEventListener('click',start);
  $('settings-button').addEventListener('click',()=>pause(true));$('map-button').addEventListener('click',()=>{pause();tab('map');});
  $('reset-position').addEventListener('click',()=>{reset();drawMap($('pause-map'),true);});
  for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>tab(b.dataset.tab));
  lastTime=performance.now();requestAnimationFrame(tick);
  // Read-only diagnostics are useful for reproducible desktop QA and user reports.
  window.kinetic={snapshot:()=>({playing,position:{x:player.x,y:player.y,z:player.z},velocity:{x:player.vx,y:player.vy,z:player.vz},speed:player.speed,state:player.state,grounded:player.grounded,height:player.height,version:'3.0',match:match.snapshot(),health:match.player.health,shield:match.player.shield,reserve:arsenal.reserve,autoReload:arsenal.autoReload,diagnostic,editing:editor.editing,yaw:input.yaw,pitch:input.pitch,weapon:arsenal.weapon.id,ammo:arsenal.ammo,reloading:!!arsenal.reload,mode:arsenal.mode,preferences:{...preferences},metrics:{...metrics},horizontalFov:params.hFov,verticalFov:view.camera.fov,aspect:view.camera.aspect,fps,drawCalls:view.stats.calls,triangles:view.stats.triangles,shots,hits,params:{...params}})};
  if(diagnostic){
    const qa={player,input,view,arsenal,editor,preferences,minimap,reticle,pause,start,tab,match,beginSimulation};window.kineticQA=qa;
    const run=document.createElement('button');run.id='qa-run';run.textContent='Ejecutar pruebas HUD';run.className='qa-run';document.body.append(run);
    run.onclick=async()=>{run.disabled=true;try{const {runHUDChecks}=await import('./verify-hud-v3.js');const result=await runHUDChecks(qa);const box=document.createElement('pre');box.id='qa-results';box.className='qa-results';box.textContent=JSON.stringify(result,null,2);document.getElementById('qa-results')?.remove();document.body.append(box);run.textContent=result.passed+' / '+result.total+' HUD';}catch(e){run.textContent='Error: '+e.message;console.error(e);}finally{run.disabled=false;}};
  }
}catch(error){
  console.error(error);$('load-status').hidden=true;$('fatal-text').textContent=error.message+' — Abre el proyecto mediante GitHub Pages (HTTPS), con todos sus archivos en la misma carpeta.';$('fatal').hidden=false;
}

// Optional offline cache; a failed/unsupported cache never blocks the playable.
if(!diagnostic&&'serviceWorker' in navigator&&location.protocol==='https:'){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>{}),{once:true});
}
