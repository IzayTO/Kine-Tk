import {PALETTE} from './level.js';
// Surface-only interventions, placed against existing structural volumes. The solid list is untouched.
export function refineLevel(level){
 PALETTE.floor=0x7d8b88;PALETTE.asphalt=0x455f64;PALETTE.steel=0x58747c;PALETTE.light=0xc8cec2;PALETTE.concrete=0xb8bdb4;
 const add=(id,x,y,z,w,h,d,mat='steel')=>level.visuals.push({type:'box',id:'v2 '+id,x,y,z,w,h,d,mat,angle:0});
 // Narrow jambs sit inside the original piers, preserving loading-door widths.
 for(const z of [-19,17]){for(const x of [-37.06,-28.94])add('loading jamb',x,2.4,z+.26,.09,4.8,.035,'teal');add('loading lintel',-33,5.06,z+.30,8,.09,.04,'dark');}
 for(const x of [-10.05,-3.95,7.95,14.05])add('control jamb',x,2.4,-23.68,.10,4.8,.04,'dark');
 // Beam bearing plates: modest connection detail at the four actual supports.
 for(const x of [-40.5,-20.2])for(const z of [-17,-6,5,16])add('bearing plate',x,6.65,z,.78,.12,.78,'steel');
 for(const x of [-30,27]){add('gantry joint',x,9.35,-14,.94,.16,1.10,'dark');add('gantry foot collar',x,.65,-14,1.02,.10,1.02,'steel');}
 for(const x of [-12,5])add('deck bearing',x,2.80,-8,1.55,.08,1.55,'dark');
 // Material bands explain the ceiling / floor junction, without extra shadow passes.
 add('workshop skirting',-41.68,.16,-1,.035,.28,35.6,'steel');
 add('control rear skirting',13.5,.15,-41.68,16.8,.26,.035,'steel');
 add('control west skirting',-8.5,.15,-41.68,10.8,.26,.035,'steel');
 add('port inset trim',-2,1.78,14.02,9,.05,.025,'teal');
 add('duct outlet trim',36.02,1.69,20,.025,.055,5.6,'teal');
 return level;
}
