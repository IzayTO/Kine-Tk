/* KINETIC — deterministic kinematic cylinder, metres / seconds. No render dependency.
   Convex prisms and analytic ramps share their geometry with the visible level.
   Fixed 120 Hz + displacement subdivision (<= 12 cm) prevents thin-wall tunnelling.
   Flat cylinder caps intentionally make stairs and low clearances predictable. */
export const DEFAULTS = Object.freeze({
  walkSpeed:4.2, runSpeed:7.4, sprintSpeed:11.5, acceleration:46, friction:8,
  jumpSpeed:8.6, gravity:24, slideBoost:2.6, slideDuration:1.25, slideDrag:4.2,
  airControl:0.34, sensitivity:1, hFov:100, cameraMotion:0.65, recoil:0.65,
  resolution:1, autoResolution:true, autoSprint:false, contextualSlide:true, sound:true
});
export const BODY = Object.freeze({radius:0.31, stand:1.82, crouch:1.02, slide:0.76, step:0.32});
export const FIXED_DT = 1/120;
const EPS=0.001;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
export const horizontalToVertical=(degrees,aspect)=>2*Math.atan(Math.tan(degrees*Math.PI/360)/aspect)*180/Math.PI;

// Clock used by the game and by the reproducible 30/60/144 Hz tests.
export class FixedClock {
  constructor(){this.accumulator=0;this.time=0;}
  reset(){this.accumulator=0;}
  advance(frameDt,step){
    this.accumulator+=Math.min(Math.max(frameDt,0),0.1);
    let n=0;
    while(this.accumulator+1e-10>=FIXED_DT && n<12){step(FIXED_DT);this.time+=FIXED_DT;this.accumulator-=FIXED_DT;n++;}
    return clamp(this.accumulator/FIXED_DT,0,1);
  }
}

// Polygons use counter-clockwise winding in the x/z coordinate plane.
export function rectPoly(x,z,w,d,angle=0){
  const c=Math.cos(angle),s=Math.sin(angle);
  return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>[x+a*c-b*s,z+a*s+b*c]);
}
export function makeCollider(poly,bottom,top,id='',slopeX=0,slopeZ=0,originX=0,originZ=0){
  return {poly,bottom,top,id,slopeX,slopeZ,originX,originZ,
    minX:Math.min(...poly.map(p=>p[0])),maxX:Math.max(...poly.map(p=>p[0])),
    minZ:Math.min(...poly.map(p=>p[1])),maxZ:Math.max(...poly.map(p=>p[1]))};
}
export function surfaceY(c,x,z){return c.top+c.slopeX*(x-c.originX)+c.slopeZ*(z-c.originZ);}
export function circleContact(c,x,z,r){
  if(x+r<c.minX || x-r>c.maxX || z+r<c.minZ || z-r>c.maxZ) return null;
  let inside=true,dist2=Infinity,qx=0,qz=0,nx=0,nz=0;
  for(let i=0;i<c.poly.length;i++){
    const a=c.poly[i], b=c.poly[(i+1)%c.poly.length],ex=b[0]-a[0],ez=b[1]-a[1];
    if(ex*(z-a[1])-ez*(x-a[0]) < -1e-9) inside=false;
    const t=clamp(((x-a[0])*ex+(z-a[1])*ez)/(ex*ex+ez*ez),0,1);
    const px=a[0]+t*ex,pz=a[1]+t*ez,dd=(x-px)**2+(z-pz)**2;
    if(dd<dist2){dist2=dd;qx=px;qz=pz;const len=Math.hypot(ex,ez);nx=ez/len;nz=-ex/len;}
  }
  const dist=Math.sqrt(dist2);
  if(!inside && dist>=r) return null;
  if(!inside && dist>1e-8){nx=(x-qx)/dist;nz=(z-qz)/dist;}
  return {nx,nz,depth:inside?r+dist:r-dist,x:inside?x:qx,z:inside?z:qz,inside};
}
export class CollisionWorld {
  constructor(colliders){
    this.colliders=colliders;this.grid=new Map();this.cell=8;
    for(const c of colliders){
      for(let x=Math.floor(c.minX/8);x<=Math.floor(c.maxX/8);x++)
        for(let z=Math.floor(c.minZ/8);z<=Math.floor(c.maxZ/8);z++){
          const key=x+','+z;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(c);
        }
    }
  }
  query(x,z,r=BODY.radius){
    const seen=new Set(),out=[];
    for(let i=Math.floor((x-r)/8);i<=Math.floor((x+r)/8);i++)
      for(let j=Math.floor((z-r)/8);j<=Math.floor((z+r)/8);j++)
        for(const c of this.grid.get(i+','+j)||[])if(!seen.has(c)){seen.add(c);out.push(c);}
    return out;
  }
  clear(x,y,z,height,r=BODY.radius,ignore=null){
    for(const c of this.query(x,z,r)){
      if(c===ignore || c.bottom>=y+height-EPS)continue;
      const hit=circleContact(c,x,z,r-0.002);
      if(hit && surfaceY(c,hit.x,hit.z)>y+EPS)return false;
    }return true;
  }
  support(x,y,z,up=0.04,down=0.12){
    let best=null;
    for(const c of this.query(x,z)){
      const hit=circleContact(c,x,z,BODY.radius-0.025);if(!hit)continue;
      const h=surfaceY(c,hit.x,hit.z);
      if(h<=y+up+EPS && h>=y-down-EPS && (!best || h>best.y))best={y:h,c};
    }return best;
  }
}
export class Player {
  constructor(world,params={...DEFAULTS},spawn={x:0,y:0,z:39,yaw:0}){
    this.world=world;this.params=params;this.spawn={...spawn};this.reset();
  }
  reset(spawn=this.spawn){
    this.x=spawn.x;this.y=spawn.y;this.z=spawn.z;this.vx=0;this.vy=0;this.vz=0;
    this.height=BODY.stand;this.grounded=true;this.state='QUIETO';
    this.sliding=false;this.slideTime=0;this.slideCooldown=0;this.coyote=0.1;
    this.jumpBuffer=0;this.time=0;this.landImpact=0;this.jumpEvent=false;this.landEvent=false;
    this.ground=null;this.groundTime=0.2;this.blockedStand=false;this.distance=0;
    this.previous={x:this.x,y:this.y,z:this.z};
  }
  get speed(){return Math.hypot(this.vx,this.vz);}
  requestJump(){this.jumpBuffer=0.14;}
  trySlide(){
    const p=this.params;
    if(this.sliding){this.sliding=false;return false;}
    if(!this.grounded || this.speed<Math.min(5.4,p.runSpeed*0.75) || this.slideCooldown>0 || this.groundTime<0.035)return false;
    this.sliding=true;this.slideTime=0;this.slideCooldown=0.58;
    const cap=Math.min(18,Math.max(p.sprintSpeed*1.28,p.runSpeed+2));
    const old=this.speed,next=Math.max(old,Math.min(cap,old+p.slideBoost));
    if(old>0){this.vx*=next/old;this.vz*=next/old;}
    this.height=BODY.slide;
    return true;
  }
  step(dt,input={}){
    this.previous.x=this.x;this.previous.y=this.y;this.previous.z=this.z;
    this.jumpEvent=false;this.landEvent=false;this.landImpact=0;
    this.time+=dt;this.slideCooldown=Math.max(0,this.slideCooldown-dt);
    if(input.jump)this.requestJump();
    if(input.slide)this.trySlide();
    this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
    this.coyote=this.grounded?0.105:Math.max(0,this.coyote-dt);
    this.groundTime=this.grounded?this.groundTime+dt:0;
    if(this.sliding){this.slideTime+=dt;if(this.slideTime>=this.params.slideDuration || this.speed<2.2)this.sliding=false;}
    const wantedHeight=this.sliding?BODY.slide:(input.crouch?BODY.crouch:BODY.stand);
    this.blockedStand=false;
    if(wantedHeight<this.height)this.height=wantedHeight;
    else if(wantedHeight>this.height){
      const next=Math.min(wantedHeight,this.height+dt*6);
      if(this.world.clear(this.x,this.y,this.z,next))this.height=next;
      else this.blockedStand=true;
    }
    const crouched=this.height<BODY.stand-0.05;
    let ix=input.x||0,iz=input.z||0;
    const raw=Math.hypot(ix,iz);if(raw>1){ix/=raw;iz/=raw;}
    const magnitude=Math.min(1,raw),yaw=input.yaw||0;
    const wx=ix*Math.cos(yaw)+iz*Math.sin(yaw),wz=-ix*Math.sin(yaw)+iz*Math.cos(yaw);
    const ux=magnitude?wx/magnitude:0,uz=magnitude?wz/magnitude:0;
    const p=this.params;
    const sprint=!!input.sprint && magnitude>0.1 && !crouched;
    let target=(crouched?2.8:(sprint?p.sprintSpeed:input.walk?p.walkSpeed:p.runSpeed))*magnitude;
    const groundedBefore=this.grounded;
    if(this.grounded && this.sliding){
      // Steering rotates the momentum vector without replenishing lost energy.
      let s=this.speed;
      if(s>0.1 && magnitude>0.1){
        const a=Math.atan2(this.vz,this.vx),b=Math.atan2(uz,ux);
        const diff=Math.atan2(Math.sin(b-a),Math.cos(b-a)),angle=a+clamp(diff,-dt*0.95,dt*0.95);
        this.vx=Math.cos(angle)*s;this.vz=Math.sin(angle)*s;
      }
      if(this.ground){const c=this.ground,den=1+c.slopeX*c.slopeX+c.slopeZ*c.slopeZ;
        this.vx-=p.gravity*c.slopeX/den*dt;this.vz-=p.gravity*c.slopeZ/den*dt;}
      s=this.speed;const reduced=Math.max(0,s-p.slideDrag*dt);
      if(s){this.vx*=reduced/s;this.vz*=reduced/s;}
    }else if(this.grounded){
      if(magnitude<0.05){const drop=Math.max(1.8,this.speed)*p.friction*dt,s=this.speed;
        if(s){const f=Math.max(0,s-drop)/s;this.vx*=f;this.vz*=f;}
      }else{
        // Keep aligned surplus momentum after a slide jump; turns still brake.
        const along=this.vx*ux+this.vz*uz,sideX=this.vx-ux*along,sideZ=this.vz-uz*along;
        const lateral=Math.exp(-p.friction*0.85*dt);
        let parallel=along;
        if(parallel<target)parallel=Math.min(target,parallel+p.acceleration*dt);
        else parallel=Math.max(target,parallel-(crouched||input.walk?p.acceleration*0.7:p.friction*0.16)*dt);
        this.vx=ux*parallel+sideX*lateral;this.vz=uz*parallel+sideZ*lateral;
      }
    }else if(magnitude>0.05){
      const along=this.vx*ux+this.vz*uz;
      const add=Math.max(0,Math.min(p.acceleration*p.airControl*dt,p.runSpeed*magnitude-along));
      this.vx+=ux*add;this.vz+=uz*add;
    }
    const maxSpeed=Math.max(18,p.sprintSpeed*1.32),speed=this.speed;
    if(speed>maxSpeed){this.vx*=maxSpeed/speed;this.vz*=maxSpeed/speed;}
    if(this.jumpBuffer>0 && this.coyote>0){
      // Need real clearance, including when inside the service duct.
      if(this.world.clear(this.x,this.y+0.08,this.z,this.height)){
        this.vy=p.jumpSpeed;this.grounded=false;this.ground=null;
        this.coyote=0;this.jumpBuffer=0;this.sliding=false;this.jumpEvent=true;
      }
    }
    this.vy-=p.gravity*dt;
    const parts=Math.max(1,Math.ceil(Math.max(this.speed,Math.abs(this.vy))*dt/0.12));
    for(let i=0;i<parts;i++)this.move(dt/parts);
    if(!groundedBefore && this.grounded){this.landEvent=true;this.groundTime=0;}
    this.distance+=Math.hypot(this.x-this.previous.x,this.z-this.previous.z);
    if(this.y< -15 || !Number.isFinite(this.x+this.y+this.z))this.reset();
    this.state=this.sliding?'DESLIZANDO':!this.grounded?(this.vy>0?'SALTANDO':'CAYENDO'):
      this.height<BODY.stand-0.05?'AGACHADO':this.speed<0.15?'QUIETO':sprint?'SPRINT':input.walk?'CAMINANDO':'CORRIENDO';
  }
  move(dt){
    const canStep=this.grounded && this.vy<=0;
    this.x+=this.vx*dt;this.z+=this.vz*dt;
    // Solve horizontal constraints first. Contact normals remove only inward velocity.
    for(let pass=0;pass<5;pass++){
      let resolved=false;
      for(const c of this.world.query(this.x,this.z)){
        if(this.y+this.height<=c.bottom+EPS)continue;
        const hit=circleContact(c,this.x,this.z,BODY.radius);if(!hit)continue;
        const top=surfaceY(c,hit.x,hit.z);
        if(top<=this.y+EPS)continue;
        if(canStep && top-this.y<=BODY.step+EPS && this.world.clear(this.x,top,this.z,this.height,BODY.radius,c)){
          this.y=top;this.ground=c;continue;
        }
        this.x+=hit.nx*(hit.depth+EPS);this.z+=hit.nz*(hit.depth+EPS);
        const inward=this.vx*hit.nx+this.vz*hit.nz;
        if(inward<0){this.vx-=hit.nx*inward;this.vz-=hit.nz*inward;}
        resolved=true;
      }if(!resolved)break;
    }
    const oldY=this.y,head=oldY+this.height;
    let nextY=oldY+this.vy*dt,support=null;
    const nearby=this.world.query(this.x,this.z);
    if(this.vy<=0){
      for(const c of nearby){
        const hit=circleContact(c,this.x,this.z,BODY.radius-0.015);if(!hit)continue;
        const top=surfaceY(c,hit.x,hit.z);
        if(top<=oldY+EPS && nextY<=top+EPS && (!support || top>support.y))support={y:top,c};
      }
      if(!support && canStep)support=this.world.support(this.x,oldY,this.z,0.002,0.26);
      if(support){nextY=support.y;this.landImpact=Math.max(this.landImpact,-this.vy);this.vy=0;}
    }else{
      for(const c of nearby){
        if(c.bottom<head-EPS || c.bottom>nextY+this.height)continue;
        const hit=circleContact(c,this.x,this.z,BODY.radius-0.003);
        if(hit){nextY=Math.min(nextY,c.bottom-this.height-EPS);this.vy=0;}
      }
    }
    this.y=nextY;this.grounded=!!support;this.ground=support?.c||null;
  }
}
