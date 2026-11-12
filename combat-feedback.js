import {clamp} from './physics.js';
// A shuffled bag gives every eligible line equal frequency, without frame-by-frame randomness.
export const KILL_PHRASES=Object.freeze([
 ['mató a'],['apuñaló a','knife'],['asesinó a'],['escopeteó a','shotgun'],['mandó al lobby a'],['puso a descansar a'],['puso a dormir a'],['despidió a'],['le arrebató los sueños a'],['arremetió contra'],['cobró venganza contra'],
 ['sacó de circulación a'],['dejó fuera de combate a'],['apagó el radar de'],['ganó el duelo contra'],['cerró la partida de']
]);
export class KillPhrases{
 constructor(random=Math.random){this.random=random;this.bag=[];}
 next(weapon){let eligible=this.bag.filter(i=>!KILL_PHRASES[i][1]||KILL_PHRASES[i][1]===weapon);if(!eligible.length){this.bag=KILL_PHRASES.map((_,i)=>i);for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}eligible=this.bag.filter(i=>!KILL_PHRASES[i][1]||KILL_PHRASES[i][1]===weapon);}const index=eligible[0];this.bag.splice(this.bag.indexOf(index),1);return KILL_PHRASES[index][0];}
}
export function radarOpacity(age){return age<0||age>=3.2?0:age<1.8?1:1-(age-1.8)/1.4;}
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const breath=t=>.62+.18*(.5-.5*Math.cos(t*Math.PI*2/.9));
export function vignetteState(a,time){
 if(!a.alive)return{damage:0,healing:0,color:'green'};
 const since=time-a.lastDamage,hit=since<1?Math.pow(clamp(1-since,0,1),.6)*.84:0;
 const critical=a.health<=15,low=a.health<50?(critical?.34:.19)+(critical?.30:.17)*(.5+.5*Math.sin(time*Math.PI*2*(critical?.85:.4))):0;
 const use=a.consuming,done=time-(a.consumedAt??-100),kind=use?.kind||a.consumedKind;
 // Visible throughout the use: a continuous breath, never a flashing on/off layer.
 const heal=use?breath(time-use.start)*smooth((time-use.start)/.12):done<.45?breath(kind==='mini'?2:3.5)*(1-smooth(done/.45)):0;
 return{damage:Math.max(hit,low),healing:heal,color:(use?.kind||a.consumedKind)==='mini'?'blue':'green'};
}

export const DEATH_PHRASES=Object.freeze(['TE ELIMINARON','TE REINICIARON','TE ASESINARON','TE ANIQUILARON','FUISTE DESPEDIDO DE LA VIDA','TE MANDARON AL LOBBY','TE RESETEARON EL HARDWARE','TE ACRIBILLARON','TU SEÑAL SE APAGÓ','TE CERRARON LA SESIÓN','TE DEJARON SIN RESPUESTA','PAUSA TÉCNICA FORZOSA']);
export class DeathPhrases{
 constructor(random=Math.random){this.random=random;this.bag=[];this.last=null;}
 next(){if(!this.bag.length){this.bag=[...DEATH_PHRASES];for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}if(this.bag.at(-1)===this.last)[this.bag[0],this.bag[this.bag.length-1]]=[this.bag.at(-1),this.bag[0]];}return this.last=this.bag.pop();}
}
export function deathState(age){return{black:.94*smooth(age/.23),red:.86*smooth((age-.14)/.40),text:smooth((age-.12)/.32),lift:12*(1-smooth((age-.12)/.42)),scale:.95+.05*smooth((age-.12)/.42)};}

// Four mounted rows, unlimited chronological backlog; timers start on display, not on kill.
export class FeedQueue{
 constructor(){this.reset();}
 reset(){this.pending=[];this.head=0;this.active=[];this.sequence=0;}
 push(event){this.pending.push({...event,sequence:this.sequence++});}
 update(time){for(let i=this.active.length-1;i>=0;i--)if(time-this.active[i].at>=3.24)this.active.splice(i,1);
  while(this.active.length<4&&this.head<this.pending.length)this.active.push({...this.pending[this.head++],at:time});
  if(this.head>64||this.head===this.pending.length){this.pending.splice(0,this.head);this.head=0;}return this.active;
 }
 dismiss(sequence,time){const i=this.active.findIndex(e=>e.sequence===sequence);if(i>=0)this.active.splice(i,1);this.update(time);}
}
