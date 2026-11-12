import {V2_DEFAULTS,savePreferences} from './preferences.js';
import {Reticle} from './hud.js';
export const preferenceSliders=[
 ['mouseX','Mouse · Horizontal',.2,3,.05,'×','look'],['mouseY','Mouse · Vertical',.2,3,.05,'×','look'],['mouseADS','Mouse · ADS',.15,1.5,.05,'×','look'],
 ['touchX','Táctil · Horizontal',.2,3,.05,'×','look'],['touchY','Táctil · Vertical',.2,3,.05,'×','look'],['touchADS','Táctil · ADS',.15,1.5,.05,'×','look'],
 ['assistStrength','Asistencia · Intensidad',0,4,.05,'×','assist'],['assistRadius','Asistencia · Radio angular',1,9,.5,'°','assist'],['assistSlowdown','Asistencia · Reducción sensibilidad',0,.65,.02,'×','assist'],['assistRange','Asistencia · Alcance',5,110,1,'m','assist'],
 ['reticleDiameter','Diámetro del círculo',4,80,1,'px','reticle'],
 ['volumeEffects','Efectos',0,1,.05,'×','audio'],['volumeWeapons','Armas',0,1,.05,'×','audio'],['volumeSteps','Pasos',0,1,.05,'×','audio'],['volumeAmbient','Ambiente',0,1,.05,'×','audio'],['volumeInterface','Interfaz',0,1,.05,'×','audio'],
 ['reticleWidth','Grosor',.5,3,.25,'px','reticle'],['reticleLength','Longitud',1,12,.5,'px','reticle'],['reticleGap','Separación',0,12,.5,'px','reticle'],['reticleSize','Tamaño',.55,1.6,.05,'×','reticle'],['reticleOpacity','Opacidad',0,1,.05,'×','reticle']
];
export function setupV2Settings(p,onChange=()=>{}){
 const preview=new Reticle(document.getElementById('reticle-preview'),p);
 const refresh=()=>{for(const [key,,,,step,unit]of preferenceSliders){const el=document.getElementById('v2-'+key);el.value=p[key];document.getElementById('v2-value-'+key).textContent=Number(p[key]).toFixed(step>=1?0:2)+' '+unit;}for(const key of ['invertY','assist','assistMouse','assistTracking','autoInteract','mapRotate','reticleDot','reticleDynamic'])document.getElementById(key).checked=p[key];document.getElementById('sightShape').value=p.sightShape;document.getElementById('reticleStyle').value=p.reticleStyle;document.getElementById('reticleColor').value=p.reticleColor;preview.update(p.reticleDynamic?.02:0,65,300);onChange();};
 for(const [key,label,min,max,step,unit,group]of preferenceSliders){const el=document.createElement('div');el.className='setting';el.innerHTML=`<label for="v2-${key}">${label}<output id="v2-value-${key}"></output></label><input id="v2-${key}" type="range" min="${min}" max="${max}" step="${step}">`;document.getElementById(group+'-settings').append(el);el.querySelector('input').addEventListener('input',e=>{p[key]=+e.target.value;savePreferences(p);refresh();});}
 for(const key of ['invertY','assist','assistMouse','assistTracking','autoInteract','mapRotate','reticleDot','reticleDynamic'])document.getElementById(key).onchange=e=>{p[key]=e.target.checked;savePreferences(p);refresh();};
 for(const key of ['reticleStyle','reticleColor','sightShape'])document.getElementById(key).oninput=e=>{p[key]=e.target.value;if(key==='reticleStyle'&&p[key]==='dynamic')p.reticleDynamic=true;savePreferences(p);refresh();};
 document.getElementById('reset-v2-settings').onclick=()=>{Object.assign(p,V2_DEFAULTS);savePreferences(p);refresh();};refresh();return refresh;
}
