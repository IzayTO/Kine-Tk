// Display names never expose the internal personality. Stable within a match.
export const BOT_TAGS=Object.freeze([
 'ZeroRush','Nox.exe','RastroNegro','VOID_7','BalaPerdida','LowPing','Karma404',
 'DobleFilo','SinRetorno','NieblaX','RushGris','UltimoTick','MalaRacha','GhostMode',
 'FueraDeRango','CeroTestigos','Backfire','NightShift','TiltControl','RecoilKid',
 'PixelMuerto','NoScopeMX','Ruptura','BlackEcho','Clutch_9','LagMental',
 'Ceniza','FaseCero','SinCheckpoint','AfterKill','Muteado','HardReset',
 'Sombra21','Vanta','Overpeek','R3LOAD','RayoSeco','OffAngle','MalTiming','PuntoCiego',
 'Nico.wav','DaniR_7','AlexSinPing','ValeFPS','Leo.MX'
]);
export function botNames(count,random=Math.random){
 const pool=[...BOT_TAGS];for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,count);
}
