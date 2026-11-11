/* NODO 09 — an authored 96 x 96 m maintenance campus, no random placement.
   +z: arrival / south. -z: control hall / north. All dimensions are metres.
   Render and collision descriptions are produced together, once at startup. */
import {rectPoly,makeCollider} from './physics.js';
export const PALETTE={concrete:0xb9beb5,light:0xd1d2c5,dark:0x364d53,steel:0x607980,
  floor:0x7e8a87,asphalt:0x4b6267,coral:0xe77852,teal:0x38a89d,yellow:0xe8be63,
  white:0xe8e6d4,shadow:0x42565a,glass:0x53767a};
export function createLevel(){
  const solids=[],visuals=[],labels=[],targets=[],zones=[];
  const add=(v,collider)=>{visuals.push(v);if(collider)solids.push(collider);return v;};
  function box(id,x,y,z,w,h,d,mat='concrete',collision=true,angle=0){
    const poly=rectPoly(x,z,w,d,angle);
    return add({type:'box',id,x,y,z,w,h,d,mat,angle},collision?makeCollider(poly,y-h/2,y+h/2,id):null);
  }
  function prism(id,poly,bottom,top,mat='concrete',collision=true,sx=0,sz=0,ox=0,oz=0){
    return add({type:'prism',id,poly,bottom,top,mat,sx,sz,ox,oz},collision?makeCollider(poly,bottom,top,id,sx,sz,ox,oz):null);
  }
  function ramp(id,x,z,w,d,low,high,axis='z',sign=-1,mat='concrete'){
    const slope=sign*(high-low)/(axis==='z'?d:w);
    return prism(id,rectPoly(x,z,w,d),low-0.12,(low+high)/2,mat,true,axis==='x'?slope:0,axis==='z'?slope:0,x,z);
  }
  function column(id,x,z,r,h,y=0,mat='concrete'){
    const poly=Array.from({length:8},(_,i)=>[x+Math.cos(i*Math.PI/4)*r,z+Math.sin(i*Math.PI/4)*r]);
    prism(id,poly,y,y+h,mat);
    box(id+'-foot',x,y+0.12,z,r*2.35,0.24,r*2.35,'dark');
  }
  function stairs(id,x,z,w,count,rise,tread,dir=-1,base=0){
    for(let i=0;i<count;i++)box(id+'-'+i,x,base+(i+1)*rise/2,z+dir*(i+0.5)*tread,w,(i+1)*rise,tread,'concrete');
    for(let i=0;i<count;i++)box(id+'-lip-'+i,x,base+(i+1)*rise+0.007,z+dir*(i+0.9)*tread,w,0.015,0.055,'yellow',false);
  }
  function line(x,z,w,d,mat='teal',y=0.012){box('route',x,y,z,w,0.018,d,mat,false);}
  function sign(text,sub,x,y,z,w=5,angle=0,color='white'){labels.push({text,sub,x,y,z,w,angle,color});}
  function rail(x,y,z,w,d,angle=0){box('parapet',x,y+0.38,z,w,0.76,d,'dark',true,angle);box('rail cap',x,y+0.78,z,w+0.04,0.08,d+0.06,'yellow',false,angle);}
  const zone=(name,x,z,w,d)=>zones.push({name,x,z,w,d});

  // Site plinth and retaining perimeter; four clipped corner buttresses.
  box('ground',0,-0.4,0,100,0.8,100,'floor');
  box('west boundary',-49,4,0,2,8,100,'concrete');box('east boundary',49,4,0,2,8,100,'concrete');
  box('north boundary',0,4,-49,100,8,2,'concrete');box('south boundary',0,3,49,100,6,2,'concrete');
  for(const x of [-46,46])for(const z of [-46,46])box('corner buttress',x,2,z,6,4,6,'steel',true,Math.PI/4);
  for(let n=-40;n<=40;n+=10){box('perimeter rib',-47.85,2.8,n,0.24,5.6,0.5,'steel',false);box('perimeter rib',47.85,2.8,n,0.24,5.6,0.5,'steel',false);}
  box('east sprint surface',43,0.006,0,8,0.012,87,'asphalt',false);
  box('arrival surface',0,0.006,36,78,0.012,19,'asphalt',false);
  box('north court surface',0,0.006,-19,80,0.012,8,'asphalt',false);
  for(let z=-38;z<42;z+=8){line(43,z,0.12,3,'yellow');line(39.3,z,0.08,5,'white');}
  for(let x=-35;x<37;x+=7)line(x,43,3,0.1,'white');
  // Entry canopy and a strong, readable first sightline.
  box('arrival canopy',0,4.1,42,15,0.35,5,'steel');
  box('entry support left',-7,2,42,0.5,4,0.5,'dark');box('entry support right',7,2,42,0.5,4,0.5,'dark');
  box('canopy trim',0,4.35,44.5,15,0.2,0.2,'teal',false);
  sign('NODO 09','COMPLEJO DE MANTENIMIENTO',0,3,47.9,10,0);
  line(0,29,0.24,23,'teal');line(15,36,30,0.18,'teal');
  for(let i=0;i<3;i++){
    box('approach fin',-13-i*2.2,1.3,30+i*1.4,0.7,2.6,7,'concrete',true,-0.32);
    box('approach coping',-13-i*2.2,2.62,30+i*1.4,0.82,0.1,7.1,'coral',false,-0.32);
  }
  box('arrival bench',24,0.48,30,8,0.95,1.5,'light');
  box('arrival bench leg',24,0.19,31.1,8.2,0.38,0.7,'dark');
  sign('01 / PATIO','IMPULSO → PASO BAJO → RAMPA',-7,2.1,23,5.2,0,'teal');
  box('wayfinding board',-7,2.1,22.94,5.3,1.4,0.1,'dark');
  for(const x of [-9.2,-4.8])box('wayfinding support',x,0.73,22.94,0.10,1.46,0.10,'steel');

  // The first action block: sprint / 1.12 m clearance / ramp / elevated junction.
  box('slide port roof',-2,1.43,15.7,9,0.62,3.4,'steel');
  box('slide port west',-6.75,0.87,15.7,0.5,1.74,3.4,'concrete');
  box('slide port east',2.75,0.87,15.7,0.5,1.74,3.4,'concrete');
  box('port yellow edge',-2,1.77,17.42,9.4,0.08,0.10,'yellow',false);
  sign('↓ DESLIZA','ALTURA LIBRE 1.12 m',-2,1.43,17.43,2.4,0,'yellow');
  ramp('central ascent',-3,2.5,6,15,0,3.2,'z',-1);
  line(-5.7,2.5,0.12,15,'teal',1.62); // renderer replaces this with a sloped stripe below
  visuals.pop();
  prism('ramp route',rectPoly(-5.7,2.5,0.12,15),-0.01,1.618,'teal',false,0,-3.2/15,-3,2.5);
  box('central upper deck',-3.5,2.98,-8,21,0.44,6,'concrete');
  rail(-4,3.2,-10.8,19,0.24);rail(3.5,3.2,-5.15,6.4,0.24);
  box('deck coral fascia',-3.5,3,-4.97,21,0.28,0.08,'coral',false);
  for(const x of [-12,5])column('deck pier',x,-8,0.65,2.76);
  box('west bridge',-22.5,3,-8,17,0.4,4,'steel');
  rail(-23,3.2,-9.9,16,0.16);rail(-23,3.2,-6.1,16,0.16);
  box('east bridge',15.5,3,-8,17,0.4,4,'steel');
  rail(15.2,3.2,-9.9,15.6,0.16);rail(14,3.2,-6.1,12,0.16);
  // Octagonal pump island diverts the ground route, and a tall service mast orients you.
  const pump=Array.from({length:8},(_,i)=>[8+Math.cos(i*Math.PI/4)*3.5,3+Math.sin(i*Math.PI/4)*3.5]);
  prism('pump island',pump,0,0.65,'dark');column('pump drum',8,3,1.7,2.2,0.65,'steel');
  column('vent mast',8,3,0.65,10.5,2.85,'concrete');
  box('mast band',8,10.5,3,1.5,1.3,1.5,'coral',false);
  box('mast crown',8,13.5,3,2.4,0.24,2.4,'dark',false);
  sign('09','TRANSFERENCIA',8,8,3.69,2.7,0,'white');

  // West workshop: structural bays, sawtooth roof, daylight slots, a mezzanine and real stairs.
  box('workshop floor',-30.5,0.008,-1,23,0.016,36,'light',false);
  box('workshop west wall',-42,3.4,-1,0.6,6.8,36,'concrete');
  for(const x of [-40.5,-20.2])for(const z of [-17,-6,5,16])box('workshop column',x,3.4,z,0.6,6.8,0.6,'dark');
  // end walls leave generous four metre loading doors, rather than invisible openings
  for(const z of [-19,17]){
    box('workshop end west',-39.5,2.5,z,5,5,0.5,'concrete');
    box('workshop end east',-24,2.5,z,10,5,0.5,'concrete');
    box('workshop end header',-30.5,5.85,z,23,1.7,0.6,'steel');
  }
  // East wall consists of separated piers. Openings connect the floor and elevated route.
  for(const z of [-15,0,13])box('workshop east pier',-19,2.3,z,0.5,4.6,5,'concrete');
  box('workshop east lintel',-19,6.2,-1,0.7,1.3,36,'concrete');
  for(let i=0;i<4;i++){
    const z=-14.5+i*9;
    prism('sawtooth roof',rectPoly(-30.5,z,24,7.5),6.7,7.45,'steel',true,0,0.12,-30.5,z);
    box('clerestory',-30.5,7,z+4,23,0.65,0.12,'glass',false);
    box('roof beam',-30.5,6.6,z,23,0.25,0.28,'dark');
  }
  box('mezzanine',-35.5,2.99,-7,9,0.42,20,'concrete');
  rail(-39.9,3.2,-7,0.18,19);rail(-31.1,3.2,-0.7,0.18,7);
  stairs('workshop stairs',-35.5,14.2,4.6,16,0.2,0.7,-1);
  box('stair landing',-35.5,3.05,2.3,4.6,0.3,1.5,'concrete');
  for(const z of [-14,-5]){box('repair bench',-24,0.65,z,4,1.3,2,'steel');box('repair bench top',-24,1.34,z,4.2,0.12,2.2,'dark');}
  sign('02 / TALLER','ESCALERA · PASARELA · PATIO',-26,5.8,17.36,8,0,'coral');
  sign('ACCESO SUPERIOR','+3.20 m',-41.68,2.2,10,4,Math.PI/2,'yellow');
  line(-31,9,0.14,15,'coral');

  // East terraces: ascent, an optional 2.7 m jump, and two ways back to grade.
  box('east terrace',25,1.6,-3,6,3.2,18,'concrete');
  ramp('terrace ramp',34,2.5,12,7,0,3.2,'x',-1);
  rail(25,3.2,-11.85,5.7,0.2);rail(27.9,3.2,-5.5,0.2,10);
  box('jump landing',13.5,1.2,2.5,11,2.4,7,'concrete');
  box('jump lip',18.9,2.41,2.5,0.15,0.02,7,'yellow',false);
  box('jump takeoff',22.05,3.21,2.5,0.15,0.02,7,'yellow',false);
  ramp('landing return ramp',13.5,11,6,10,0,2.4,'z',-1);
  sign('03 / TERRAZAS','SALTO 3 m · RAMPA DE RETORNO',28.1,2.2,-7,6,Math.PI/2,'teal');
  // Dedicated service underpass. Walk/crouch/slide have different physical heights.
  box('service duct roof',28,1.43,20,16,0.58,5.6,'steel');
  box('duct south wall',28,0.86,22.9,16,1.72,0.3,'concrete');
  box('duct north wall',28,0.86,17.1,16,1.72,0.3,'concrete');
  sign('PASO TÉCNICO','1.14 m',36.02,1.43,20,2.2,Math.PI/2,'yellow');
  line(28,20,16,0.16,'yellow');

  // North control hall: a U-like facade assembled with actual openings and framed windows.
  box('control floor',4,0.008,-33,36,0.016,18,'light',false);
  for(const [x,w] of [[-12,4],[2,12],[18,8]])box('control front wall',x,2.4,-24,w,4.8,0.6,'concrete');
  box('control front lintel',4,5.45,-24,36,1.3,0.7,'steel');
  for(const [x,w] of [[-8.5,11],[13.5,17]])box('control rear',x,3,-42,w,6,0.6,'concrete');
  box('rear header',1,5.1,-42,8,1.8,0.6,'concrete');
  box('control west north',-14,3,-39,0.6,6,6,'concrete');
  box('control west south',-14,3,-27,0.6,6,6,'concrete');
  box('west door lintel',-14,5.5,-33,0.7,1,6,'steel');
  box('control east base',22,0.6,-33,0.6,1.2,18,'concrete');
  box('control east head',22,5.2,-33,0.6,2,18,'concrete');
  for(const z of [-41,-36,-31,-25])box('window mullion',22,2.7,z,0.65,3,0.2,'dark');
  box('control roof',4,6.2,-33,36.5,0.4,18.5,'concrete');
  rail(4,6.4,-42.2,36,0.25);rail(-14.2,6.4,-33,0.25,18);
  rail(13,6.4,-23.85,17,0.25);rail(-10,6.4,-23.85,8,0.25);
  ramp('roof access ramp',32,-33,20,6,0,6.4,'x',-1);
  for(const x of [-7,8])for(const z of [-37,-29])column('control pillar',x,z,0.42,6);
  box('control console',5,0.62,-38,8,1.24,1.5,'steel');
  box('console display',5,1.25,-38,7,0.08,1.2,'dark',false);
  box('control angled divider',-1,1.25,-31,0.45,2.5,6,'steel',true,0.5);
  sign('04 / CONTROL','ACCESO A CUBIERTA →',3,5.4,-23.61,9,0,'teal');
  sign('N09','CONTROL DE TRANSFERENCIA',12,3.3,-41.6,7,0,'white');
  // A three-part crane is a landmark, not a repeated obstacle field.
  for(const x of [-30,27]){box('gantry leg',x,5,-14,0.8,10,0.8,'coral');box('gantry shoe',x,0.3,-14,1.8,0.6,1.8,'dark');}
  box('gantry girder',-1.5,9.8,-14,58,0.8,1,'coral');
  box('gantry upper flange',-1.5,10.24,-14,58,0.12,1.4,'dark',false);
  box('gantry trolley',2,9.1,-14,3.5,0.5,2,'steel',false);
  box('gantry cable',2,7.2,-14,0.05,3.6,0.05,'dark',false);
  box('gantry hook',2,5.45,-14,0.3,0.3,0.25,'yellow',false);
  sign('VÍA RÁPIDA','80 m / SPRINT',47.85,3.5,8,9,-Math.PI/2,'yellow');
  // Static, reusable targets are independent from decorative architecture.
  for(const t of [
    [0,1.65,25,0],[-10,1.65,5,0],[17,3.9,1.5,0],[-25,1.65,11,0],
    [-35,4.85,-15,0],[4,1.65,-37,0],[20,8.05,-38,Math.PI/2],
    [45.5,1.65,-21,Math.PI/2],[33,1.65,28,Math.PI/2],[12,4.85,-8,Math.PI/2],
    [-39,1.65,-26,0],[40,1.65,38,Math.PI/2]
  ])targets.push({x:t[0],y:t[1],z:t[2],angle:t[3],id:targets.length+1});
  zone('01 · PATIO',0,30,78,30);zone('02 · TALLER',-30,-1,25,38);
  zone('03 · TERRAZAS',24,4,30,29);zone('04 · CONTROL',4,-33,38,20);
  zone('05 · VÍA RÁPIDA',43,0,8,88);zone('06 · TRANSFERENCIA',0,-3,36,35);
  return {solids,visuals,labels,targets,zones,spawn:{x:0,y:0,z:39,yaw:0},name:'NODO 09',width:96,depth:96};
}
