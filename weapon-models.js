import * as T from './three.module.min.js';
// Batch material-compatible fixed components. Movable magazines, pump and joints remain separate.
function batch(root,exclude=[]){root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),groups=new Map(),remove=[];root.traverse(o=>{if(!o.isMesh||exclude.includes(o)||exclude.some(e=>e.getObjectById(o.id)))return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv,o.matrixWorld));if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);remove.push(o);});for(const o of remove)o.removeFromParent();for(const [m,gs]of groups){let size=0;for(const g of gs)size+=g.attributes.position.array.length;const p=new Float32Array(size);let offset=0;for(const g of gs){p.set(g.attributes.position.array,offset);offset+=g.attributes.position.array.length;g.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p,3));g.computeVertexNormals();root.add(new T.Mesh(g,m));}}
export function buildModels(){
 const materials={dark:new T.MeshLambertMaterial({color:0x24383d}),steel:new T.MeshLambertMaterial({color:0x586e72}),accent:new T.MeshLambertMaterial({color:0x3ec3a6}),wood:new T.MeshLambertMaterial({color:0x7e7762}),edge:new T.MeshLambertMaterial({color:0xb6c5bf}),glove:new T.MeshLambertMaterial({color:0x304c50})};
 const box=(g,w,h,d,x,y,z,m='dark')=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),materials[m]);o.position.set(x,y,z);g.add(o);return o;};
 const tube=(g,r,length,x,y,z,m='steel')=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,length,8),materials[m]);o.rotation.x=Math.PI/2;o.position.set(x,y,z);g.add(o);return o;};
 const sight=(g,zRear,zFront,physical=true)=>{
  // Both optical reference points are exactly on y=.14, x=0. The front post ends at that axis.
  const rear=new T.Object3D(),front=new T.Object3D();rear.position.set(0,.14,zRear);front.position.set(0,.14,zFront);g.add(rear,front);
  if(!physical)return{rear,front};
  for(const x of [-.038,.038])box(g,.012,.065,.017,x,.14,zRear);
  box(g,.086,.012,.017,0,.1785,zRear);box(g,.086,.012,.017,0,.1015,zRear);
  box(g,.008,.047,.018,0,.1165,zFront,'accent');return{rear,front};
 };
 const flash=(g,z)=>{const f=new T.Mesh(new T.ConeGeometry(.065,.16,5),new T.MeshBasicMaterial({color:0xffdc99,transparent:true,opacity:.9,depthWrite:false}));f.rotation.x=-Math.PI/2;f.position.set(0,.02,z);f.visible=false;g.add(f);return f;};
 const rifle=new T.Group();
 box(rifle,.13,.135,.38,0,0,-.08);box(rifle,.115,.11,.35,0,.012,-.43,'steel');
 box(rifle,.08,.07,.18,0,-.015,.18);box(rifle,.12,.19,.065,0,-.015,.30,'steel');box(rifle,.095,.045,.21,0,.05,.17);
 box(rifle,.09,.155,.065,0,-.115,.045).rotation.x=-.2;
 for(let i=0;i<5;i++){box(rifle,.121,.032,.025,0,.008,-.31-i*.055);box(rifle,.132,.009,.023,0,.09,-.06-i*.065);}
 tube(rifle,.022,.31,0,.025,-.72);tube(rifle,.03,.06,0,.025,-.885,'dark');
 box(rifle,.132,.018,.14,0,.03,-.07,'accent');
 const mag=new T.Group();mag.position.set(0,-.13,-.13);rifle.add(mag);box(mag,.082,.19,.10,0,-.03,0,'steel').rotation.x=.08;for(const x of [-.043,.043])for(let i=0;i<3;i++)box(mag,.005,.10,.012,x,-.04,-.03+i*.026);
 const rf=flash(rifle,-.94),rs=sight(rifle,.035,-.74);batch(mag);batch(rifle,[mag,rf]);
 const shotgun=new T.Group();
 box(shotgun,.145,.15,.29,0,0,-.07,'steel');box(shotgun,.09,.15,.075,0,-.11,.04,'wood').rotation.x=-.3;
 box(shotgun,.075,.09,.18,0,-.015,.17,'wood').rotation.x=.12;box(shotgun,.13,.21,.065,0,-.045,.29,'wood');
 tube(shotgun,.028,.72,0,.025,-.55,'dark');tube(shotgun,.024,.58,0,-.045,-.50);
 const pump=new T.Group();pump.position.z=-.47;shotgun.add(pump);box(pump,.14,.12,.24,0,-.035,0,'wood');for(let i=0;i<6;i++)box(pump,.149,.122,.012,0,-.035,-.10+i*.04,'dark');batch(pump);
 box(shotgun,.148,.055,.13,0,.008,-.08,'dark');box(shotgun,.15,.012,.06,0,.055,-.02,'accent');
 const shell=new T.Group();shell.position.set(-.07,-.14,-.06);tube(shell,.021,.07,0,0,0,'wood');shotgun.add(shell);shell.visible=false;
 const sf=flash(shotgun,-.98),ss=sight(shotgun,.025,-.82,false);batch(shotgun,[pump,shell,sf]);
 const knife=new T.Group();const wrist=new T.Group();knife.add(wrist);
 box(wrist,.09,.085,.13,0,-.015,0,'glove');for(let i=0;i<4;i++)box(wrist,.022,.04,.06,-.034+i*.024,.027,.008,'glove');
 box(wrist,.042,.048,.14,0,.027,.015,'dark');for(let i=0;i<4;i++)box(wrist,.048,.052,.013,0,.027,-.035+i*.025,'wood');
 box(wrist,.10,.018,.025,0,.027,.095,'steel');
 // Solid diamond-section blade, swept backwards and OUTSIDE the forearm.
 // Grip and guard share this rotation; the blade cannot appear pasted on the sleeve.
 const bladeRoot=new T.Group();bladeRoot.position.set(0,.028,.102);bladeRoot.rotation.y=.98;wrist.add(bladeRoot);
 const points=[[-.038,0,0],[.038,0,0],[.028,0,.19],[0,0,.33],[-.029,0,.20],[0,.018,.12],[0,-.018,.12]],faces=[[0,1,5],[1,2,5],[2,3,5],[3,4,5],[4,0,5],[1,0,6],[2,1,6],[3,2,6],[4,3,6],[0,4,6]],positions=[];
 for(const face of faces)for(const i of face)positions.push(...points[i]);const blade=new T.BufferGeometry();blade.setAttribute('position',new T.Float32BufferAttribute(positions,3));blade.computeVertexNormals();bladeRoot.add(new T.Mesh(blade,materials.edge));
 const bladeTip=new T.Object3D();bladeTip.position.set(0,0,.33);bladeRoot.add(bladeTip);batch(wrist);
 const fore=box(knife,.095,1,.11,0,0,0,'wood'),upper=box(knife,.12,1,.13,0,0,0,'glove');
 return [{root:knife,wrist,fore,upper,bladeTip,kind:'knife',muzzle:new T.Object3D(),flash:null},{root:rifle,mag,kind:'rifle',...rs,flash:rf,muzzle:rf},{root:shotgun,pump,shell,kind:'shotgun',...ss,flash:sf,muzzle:sf}];
}
export function aimTransform(model){
 const dir=model.front.position.clone().sub(model.rear.position).normalize(),q=new T.Quaternion().setFromUnitVectors(dir,new T.Vector3(0,0,-1));
 const eye=model.rear.position.clone().applyQuaternion(q);return{rotation:q,position:new T.Vector3(-eye.x,-eye.y,-.36)};
}
export function segment(mesh,a,b){mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=a.distanceTo(b);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());}
