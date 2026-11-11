import * as THREE from './three.module.min.js';
import {PALETTE} from './level.js';
import {damp,clamp,horizontalToVertical,circleContact} from './physics.js';

function prismGeometry(v){
  const positions=[],p=v.poly,n=p.length;
  const top=q=>v.top+(v.sx||0)*(q[0]-(v.ox||0))+(v.sz||0)*(q[1]-(v.oz||0));
  const tri=(a,b,c)=>positions.push(...a,...b,...c);
  for(let i=1;i<n-1;i++){
    tri([p[0][0],top(p[0]),p[0][1]],[p[i+1][0],top(p[i+1]),p[i+1][1]],[p[i][0],top(p[i]),p[i][1]]);
    tri([p[0][0],v.bottom,p[0][1]],[p[i][0],v.bottom,p[i][1]],[p[i+1][0],v.bottom,p[i+1][1]]);
  }
  for(let i=0;i<n;i++){
    const a=p[i],b=p[(i+1)%n],aa=[a[0],v.bottom,a[1]],bb=[b[0],v.bottom,b[1]],at=[a[0],top(a),a[1]],bt=[b[0],top(b),b[1]];
    tri(aa,at,bt);tri(aa,bt,bb);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
function mergeGeometry(list){
  const a=[];for(const g of list){a.push(...g.attributes.position.array);g.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function batchChildren(root,exclude=[]){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),groups=new Map(),remove=[];
  root.traverse(o=>{
    if(!o.isMesh||exclude.includes(o))return;
    const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone());
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
    if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);remove.push(o);
  });
  for(const o of remove)o.removeFromParent();
  for(const [mat,geometries]of groups)root.add(new THREE.Mesh(mergeGeometry(geometries),mat));
}
function coloredMesh(root,material){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),geometries=[],colors=[],remove=[];
  root.traverse(o=>{if(!o.isMesh)return;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));geometries.push(g);
    const color=o.material.color;for(let i=0;i<g.attributes.position.count;i++)colors.push(color.r,color.g,color.b);remove.push(o);
  });
  for(const o of remove)o.removeFromParent();
  const g=mergeGeometry(geometries);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const mesh=new THREE.Mesh(g,material);root.add(mesh);return mesh;
}
export class WorldView {
  constructor(canvas,level,params,{render=true}={}){
    this.params=params;this.level=level;this.renderer=render?new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'}):null;
    if(this.renderer){
      this.renderer.setClearColor(0xc4d2d0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
      this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
      this.renderer.autoClear=false;
    }
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xc4d2d0,85,175);
    this.scene.add(new THREE.HemisphereLight(0xe4eeee,0x6e7364,2.2));
    const sun=new THREE.DirectionalLight(0xfff2da,2.5);sun.position.set(-40,75,35);this.scene.add(sun);
    this.camera=new THREE.PerspectiveCamera(60,1,0.055,200);
    this.gunScene=new THREE.Scene();this.gunScene.add(new THREE.HemisphereLight(0xd9eeee,0x45545b,2.3));
    const gunLight=new THREE.DirectionalLight(0xffecce,2.5);gunLight.position.set(-2,4,2);this.gunScene.add(gunLight);
    this.gunCamera=new THREE.PerspectiveCamera(55,1,0.015,8);
    this.raycast=new THREE.Raycaster();this.raycast.far=150;this.shootables=[];this.targetPlates=[];
    this.materials={};for(const [name,color]of Object.entries(PALETTE))this.materials[name]=new THREE.MeshLambertMaterial({color,flatShading:true});
    this.buildArchitecture();if(typeof document!=='undefined')this.buildSigns();this.buildTargets();this.buildWeapon();this.buildEffects();
    this.aim=0;this.poseSprint=0;this.poseSlide=0;this.eye=1.66;this.recoil=0;this.landing=0;this.jumpKick=0;
    this.phase=0;this.time=0;this.hFov=params.hFov;this.scale=1;this.width=1;this.height=1;this.lastShot=0;
    this.lookSwayX=0;this.lookSwayY=0;this.bob=0;this.roll=0;this.dynamicScale=1;
    this.stats={calls:0,triangles:0};
  }
  buildArchitecture(){
    const boxGeometry=new THREE.BoxGeometry(1,1,1),matrix=new THREE.Matrix4(),temp=new THREE.Object3D();
    for(const name of Object.keys(PALETTE)){
      const boxes=this.level.visuals.filter(v=>v.type==='box'&&v.mat===name);
      if(boxes.length){
        const mesh=new THREE.InstancedMesh(boxGeometry,this.materials[name],boxes.length);
        boxes.forEach((v,i)=>{temp.position.set(v.x,v.y,v.z);temp.rotation.set(0,-v.angle,0);temp.scale.set(v.w,v.h,v.d);temp.updateMatrix();matrix.copy(temp.matrix);mesh.setMatrixAt(i,matrix);});
        mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();this.scene.add(mesh);this.shootables.push(mesh);
      }
      const prisms=this.level.visuals.filter(v=>v.type==='prism'&&v.mat===name);
      if(prisms.length){const mesh=new THREE.Mesh(mergeGeometry(prisms.map(prismGeometry)),this.materials[name]);this.scene.add(mesh);this.shootables.push(mesh);}
    }
    // Soft, static contact patches are plain low-cost geometry, not shadow maps.
    const shade=new THREE.MeshBasicMaterial({color:0x24383b,transparent:true,opacity:0.13,depthWrite:false});
    for(const [x,z,w,d]of [[-30,-1,23,36],[4,-33,36,18],[-3.5,-8,21,6],[-2,15.7,9,3.4],[28,20,16,5.6]]){
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),shade);m.rotation.x=-Math.PI/2;m.position.set(x,0.021,z);this.scene.add(m);
    }
  }
  buildSigns(){
    // All signage shares a small canvas atlas and a single material/draw call.
    const c=document.createElement('canvas');c.width=1024;c.height=1024;
    const ctx=c.getContext('2d');ctx.fillStyle='#31464b';ctx.fillRect(0,0,1024,1024);
    const all=this.level.labels,positions=[],uv=[];const rows=8,cols=2,cw=512,ch=128;
    all.forEach((s,i)=>{
      const ox=(i%cols)*cw,oy=Math.floor(i/cols)*ch;
      ctx.fillStyle='#31464b';ctx.fillRect(ox,oy,cw,ch);
      const col='#'+PALETTE[s.color].toString(16).padStart(6,'0');
      ctx.fillStyle=col;ctx.fillRect(ox+10,oy+12,5,103);ctx.font='700 37px sans-serif';
      ctx.fillText(s.text,ox+28,oy+60,cw-46);ctx.fillStyle='#d9e0d7';ctx.font='18px sans-serif';ctx.fillText(s.sub,ox+29,oy+97,cw-47);
      const h=s.w/4,co=Math.cos(s.angle),si=Math.sin(s.angle),p=[[-s.w/2,-h/2],[s.w/2,-h/2],[s.w/2,h/2],[-s.w/2,h/2]];
      const coords=p.map(([x,y])=>[s.x+x*co,s.y+y,s.z-x*si]);
      const u0=(ox+1)/1024,u1=(ox+cw-1)/1024,v0=1-(oy+ch-1)/1024,v1=1-(oy+1)/1024;
      const tex=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
      for(const j of [0,1,2,0,2,3]){positions.push(...coords[j]);uv.push(...tex[j]);}
    });
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=this.renderer?Math.min(4,this.renderer.capabilities.getMaxAnisotropy()):1;
    const mat=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide});this.scene.add(new THREE.Mesh(g,mat));
  }
  buildTargets(){
    const ringGeo=new THREE.TorusGeometry(0.36,0.022,5,24),headGeo=new THREE.CircleGeometry(0.17,12);
    const body=new THREE.Shape();body.moveTo(-0.36,-0.65);body.lineTo(0.36,-0.65);body.lineTo(0.43,0.23);body.lineTo(0.22,0.37);body.lineTo(-0.22,0.37);body.lineTo(-0.43,0.23);body.closePath();
    const bodyGeo=new THREE.ShapeGeometry(body);
    this.level.targets.forEach((t)=>{
      const group=new THREE.Group();group.position.set(t.x,t.y,t.z);group.rotation.y=t.angle;this.scene.add(group);
      const mat=new THREE.MeshLambertMaterial({color:0xeab967,side:THREE.DoubleSide,emissive:0x000000});
      const plate=new THREE.Mesh(bodyGeo,mat);plate.userData.target=t.id;group.add(plate);
      const head=new THREE.Mesh(headGeo,mat);head.position.y=0.56;head.userData.target=t.id;group.add(head);
      const ring=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:0x293f45,side:THREE.DoubleSide}));ring.position.z=0.012;ring.position.y=-0.1;group.add(ring);
      const bull=new THREE.Mesh(new THREE.CircleGeometry(0.075,12),this.materials.coral);bull.position.set(0,-0.1,0.018);group.add(bull);
      const combinedMat=new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide,emissive:0x000000});
      const combined=coloredMesh(group,combinedMat);combined.userData.target=t.id;
      const base=new THREE.Group();group.add(base);
      const stand=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.8,0.12),this.materials.dark);stand.position.y=-1.05;base.add(stand);
      const foot=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.08,0.7),this.materials.dark);foot.position.y=-1.59;base.add(foot);
      batchChildren(base);this.shootables.push(combined,...base.children.filter(o=>o.isMesh));
      this.targetPlates.push({mat:combinedMat,time:0,id:t.id});
    });
  }
  buildWeapon(){
    this.rig=new THREE.Group();this.gunScene.add(this.rig);
    const matte=new THREE.MeshLambertMaterial({color:0x24353b,flatShading:true}),edge=new THREE.MeshLambertMaterial({color:0x536970,flatShading:true});
    const accent=new THREE.MeshLambertMaterial({color:0x3ac5af}),fabric=new THREE.MeshLambertMaterial({color:0x727c76,flatShading:true});
    const glove=new THREE.MeshLambertMaterial({color:0x2d484d,flatShading:true}),joint=new THREE.MeshLambertMaterial({color:0xa98c71,flatShading:true});
    const box=(parent,w,h,d,x,y,z,mat)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
    this.weapon=new THREE.Group();this.rig.add(this.weapon);
    box(this.weapon,0.125,0.13,0.46,0,0,-0.12,matte);
    box(this.weapon,0.14,0.07,0.25,0,0.07,-0.24,edge);
    box(this.weapon,0.105,0.12,0.24,0,0,-0.44,edge);
    box(this.weapon,0.1,0.09,0.18,0,-0.02,0.16,matte);
    box(this.weapon,0.10,0.17,0.07,0,-0.12,0.04,matte).rotation.x=-0.18;
    box(this.weapon,0.085,0.2,0.09,0,-0.14,-0.19,edge).rotation.x=0.13;
    for(let i=0;i<5;i++)box(this.weapon,0.132,0.012,0.02,0,0.09,-0.12-i*0.065,matte);
    for(let i=0;i<3;i++)box(this.weapon,0.107,0.025,0.025,0,-0.005,-0.37-i*0.06,matte);
    box(this.weapon,0.131,0.022,0.16,0,0.014,-0.04,accent);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,0.19,8),matte);barrel.rotation.x=Math.PI/2;barrel.position.set(0,0.025,-0.64);this.weapon.add(barrel);
    // Open 3D iron sight: it lines up with the reticle during aim.
    for(const x of [-0.042,0.042])box(this.weapon,0.016,0.07,0.025,x,0.135,0.01,matte);
    box(this.weapon,0.09,0.015,0.025,0,0.178,0.01,matte);
    box(this.weapon,0.012,0.055,0.02,0,0.12,-0.5,accent);
    this.muzzle=new THREE.Object3D();this.muzzle.position.set(0,0.025,-0.75);this.weapon.add(this.muzzle);
    const flashMat=new THREE.MeshBasicMaterial({color:0xffdda0,transparent:true,opacity:0.92,depthWrite:false});
    this.flash=new THREE.Mesh(new THREE.ConeGeometry(0.075,0.18,5),flashMat);this.flash.rotation.x=-Math.PI/2;this.flash.position.copy(this.muzzle.position);this.weapon.add(this.flash);this.flash.visible=false;
    // Two elbow/wrist/palm chains. Fingers are low-poly knuckles, not flat sprites.
    this.arms=[];
    for(const side of [1,-1]){
      const arm=new THREE.Group();this.rig.add(arm);this.arms.push(arm);
      const elbow=new THREE.Group();arm.add(elbow);
      const fore=box(elbow,0.12,0.12,0.46,side*0.19,-0.16,0.18,fabric);fore.rotation.x=-0.32;fore.rotation.y=side*0.38;
      const wrist=new THREE.Group();wrist.position.set(side===1?0.04:-0.07,-0.10,side===1?0.06:-0.39);elbow.add(wrist);
      box(wrist,0.105,0.08,0.07,0,0,0.04,joint);
      box(wrist,0.10,0.095,0.12,0,0,-0.02,glove);
      for(let i=0;i<4;i++){
        const finger=new THREE.Group();finger.position.set(-0.041+i*0.027,-0.012,-0.077);wrist.add(finger);
        box(finger,0.022,0.045,0.055,0,0,0,glove);box(finger,0.021,0.035,0.032,0,0.015,-0.027,glove).rotation.x=-0.6;
      }
      box(wrist,0.035,0.045,0.07,side*0.06,0.02,-0.005,glove).rotation.z=side*0.6;
      if(side===-1){fore.position.set(-0.22,-0.18,-0.12);fore.rotation.set(-0.4,-0.6,0);}
    }
    batchChildren(this.weapon,[this.flash]);for(const arm of this.arms)batchChildren(arm);
  }
  buildEffects(){
    this.impacts=[];const geo=new THREE.IcosahedronGeometry(0.045,0);
    for(let i=0;i<16;i++){
      const mat=new THREE.MeshBasicMaterial({color:0xffdf9a,transparent:true}),mesh=new THREE.Mesh(geo,mat);mesh.visible=false;this.scene.add(mesh);this.impacts.push({mesh,life:0});
    }
    this.impactIndex=0;
    const geoLine=new THREE.BufferGeometry();geoLine.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,0],3));
    this.tracer=new THREE.Line(geoLine,new THREE.LineBasicMaterial({color:0xffd28b,transparent:true,opacity:0.42}));this.scene.add(this.tracer);this.tracer.visible=false;
    this.shotTime=0;this.hit=null;
  }
  resize(w,h,force=false){
    const dpr=Math.min(window.devicePixelRatio||1,1.6),scale=dpr*this.params.resolution*this.dynamicScale;
    if(!force && w===this.width&&h===this.height&&Math.abs(scale-this.scale)<0.01)return;
    this.width=w;this.height=h;this.scale=scale;this.renderer.setPixelRatio(scale);this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h;this.gunCamera.aspect=w/h;
    this.camera.fov=horizontalToVertical(this.hFov,w/h);this.camera.updateProjectionMatrix();
    // Keep hands at a stable horizontal size across phone and desktop aspect ratios.
    this.gunCamera.fov=horizontalToVertical(86,w/h);this.gunCamera.updateProjectionMatrix();
  }
  update(dt,p,input,alpha){
    this.time+=dt;this.aim=damp(this.aim,input.aim?1:0,17,dt);
    this.poseSprint=damp(this.poseSprint,p.state==='SPRINT'?1:0,10,dt);
    this.poseSlide=damp(this.poseSlide,p.sliding?1:0,13,dt);
    this.recoil=damp(this.recoil,0,20,dt);this.landing=damp(this.landing,0,13,dt);this.jumpKick=damp(this.jumpKick,0,10,dt);
    const motion=this.params.cameraMotion;
    this.eye=damp(this.eye,p.height-0.15,18,dt);
    for(const c of p.world.query(p.x,p.z,0.04))if(c.bottom>p.y+0.1&&circleContact(c,p.x,p.z,0.04))this.eye=Math.min(this.eye,c.bottom-p.y-0.09);
    const speed=p.speed;
    if(p.grounded)this.phase+=speed*dt*1.72;
    this.bob=damp(this.bob,p.grounded&&!p.sliding?Math.min(speed/9,1):0,13,dt);
    const bobY=Math.sin(this.phase*2)*0.019*this.bob*motion*(1-this.aim*0.7);
    this.roll=damp(this.roll,(-(input.x||0)*0.009+Math.sin(this.phase)*0.003*this.bob)*motion,14,dt);
    this.camera.position.set(p.previous.x+(p.x-p.previous.x)*alpha,p.previous.y+(p.y-p.previous.y)*alpha+this.eye+bobY-this.landing*motion,p.previous.z+(p.z-p.previous.z)*alpha);
    this.camera.rotation.order='YXZ';this.camera.rotation.set(input.pitch||0,input.yaw||0,this.roll);
    const fov=damp(this.hFov,this.params.hFov-(this.params.hFov-76)*this.aim,18,dt);
    if(Math.abs(fov-this.hFov)>0.005){this.hFov=fov;this.camera.fov=horizontalToVertical(fov,this.width/this.height);this.camera.updateProjectionMatrix();}
    this.lookSwayX=damp(this.lookSwayX,clamp(input.lookDX||0,-25,25)*0.0005,13,dt);
    this.lookSwayY=damp(this.lookSwayY,clamp(input.lookDY||0,-25,25)*0.0005,13,dt);
    const firePose=this.time-this.shotTime<0.16?0.18:1;
    const sp=this.poseSprint*(1-this.aim)*firePose,sl=this.poseSlide*(1-this.aim);
    const bobX=Math.sin(this.phase)*0.014*this.bob*motion;
    this.rig.position.set(0.20*(1-this.aim)+bobX-this.lookSwayX, -0.20-this.aim*0.09+Math.cos(this.phase*2)*0.009*this.bob*motion-0.055*sp-0.04*sl+this.landing*0.38-this.jumpKick*0.02,-0.39+this.recoil*0.065+sp*0.06);
    this.rig.rotation.set(-sp*0.17+sl*0.12-this.recoil*0.06+clamp(p.vy,-10,10)*0.002*motion-this.lookSwayY,sp*0.28-sl*0.12,sp*0.29+sl*0.3+this.roll*1.5);
    this.weapon.position.y=0.12*this.aim;
    this.arms[0].rotation.x=sp*0.08+sl*0.07;this.arms[1].rotation.z=-sp*0.07+sl*0.09;
    this.flash.visible=this.time-this.shotTime<0.04&&this.shotTime>0;
    this.tracer.visible=this.time-this.shotTime<0.035&&this.shotTime>0;
    for(const e of this.impacts)if(e.life>0){e.life-=dt;e.mesh.visible=e.life>0;e.mesh.material.opacity=Math.max(0,e.life/0.24);e.mesh.scale.setScalar(1+(0.24-e.life)*7);}
    for(const t of this.targetPlates)if(t.time>0){t.time=Math.max(0,t.time-dt);t.mat.emissive.setRGB(t.time*0.4,t.time*1.8,t.time*1.4);}
    this.camera.updateMatrixWorld();this.rig.updateMatrixWorld();
  }
  onJump(){this.jumpKick=1;}
  onLand(impact){this.landing=Math.min(0.12,Math.max(0,impact-2)*0.009);}
  shoot(){
    this.shotTime=this.time;this.recoil=Math.min(1.4,this.recoil+0.8*this.params.recoil);
    this.raycast.setFromCamera(new THREE.Vector2(0,0),this.camera);
    this.scene.updateMatrixWorld();
    const hit=this.raycast.intersectObjects(this.shootables,false)[0]||null;
    const end=hit?hit.point:this.raycast.ray.at(120,new THREE.Vector3());
    if(hit){const e=this.impacts[this.impactIndex++%this.impacts.length];e.life=0.24;e.mesh.visible=true;e.mesh.position.copy(end);e.mesh.material.color.set(hit.object.userData.target?0x4fffd6:0xffd38a);}
    const target=hit?.object.userData.target||null;
    if(target){const t=this.targetPlates.find(t=>t.id===target);t.time=0.3;t.mat.emissive.setRGB(0.1,0.6,0.4);}
    const start=this.camera.position.clone().add(new THREE.Vector3(0.17,-0.14,-0.5).applyQuaternion(this.camera.quaternion));
    const attr=this.tracer.geometry.attributes.position;attr.setXYZ(0,start.x,start.y,start.z);attr.setXYZ(1,end.x,end.y,end.z);attr.needsUpdate=true;this.tracer.geometry.computeBoundingSphere();
    this.hit={target,distance:hit?.distance||0};return this.hit;
  }
  render(){
    this.renderer.info.reset();this.renderer.info.autoReset=false;
    this.renderer.clear();this.renderer.render(this.scene,this.camera);this.renderer.clearDepth();this.renderer.render(this.gunScene,this.gunCamera);
    this.stats.calls=this.renderer.info.render.calls;this.stats.triangles=this.renderer.info.render.triangles;
  }
}
