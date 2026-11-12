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
export function vignetteState(a,time){
 if(!a.alive)return{damage:0,healing:0,color:'green'};
 const since=time-a.lastDamage,hit=since<1?Math.pow(clamp(1-since,0,1),.6)*.68:0;
 const critical=a.health<=15,low=a.health<50?(critical?.30:.15)+(critical?.28:.15)*(.5+.5*Math.sin(time*Math.PI*2*(critical?.85:.4))):0;
 const use=a.consuming,done=time-(a.consumedAt??-100),heal=use?.17+.16*(.5+.5*Math.sin((time-use.start)*Math.PI*2*1.15)):done<.45?.24*(1-done/.45):0;
 return{damage:Math.max(hit,low),healing:heal,color:(use?.kind||a.consumedKind)==='mini'?'blue':'green'};
}
