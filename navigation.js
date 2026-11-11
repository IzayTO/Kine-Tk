// Navigation is derived from the original convex collision solids. Metres, feet at y.
import {BODY,clamp,circleContact,surfaceY} from './physics.js';
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function randomStream(seed=9){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
// Clip a segment against every plane of a convex prism, including its sloped roof.
// Shared by perception, bullets and melee; solid architecture always wins a tie.
export function obstruction(solids,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;let closest=1;
 for(const c of solids){if(Math.max(a.x,b.x)<c.minX||Math.min(a.x,b.x)>c.maxX||Math.max(a.z,b.z)<c.minZ||Math.min(a.z,b.z)>c.maxZ)continue;
  let lo=0,hi=closest,valid=true;
  const clip=(f,d)=>{if(Math.abs(d)<1e-10){if(f<0)valid=false;return;}const t=-f/d;if(d>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)valid=false;};
  clip(a.y-c.bottom,dy);clip(surfaceY(c,a.x,a.z)-a.y,c.slopeX*dx+c.slopeZ*dz-dy);
  for(let i=0;valid&&i<c.poly.length;i++){const p=c.poly[i],q=c.poly[(i+1)%c.poly.length],ex=q[0]-p[0],ez=q[1]-p[1];clip(ex*(a.z-p[1])-ez*(a.x-p[0]),ex*dz-ez*dx);}
  if(valid&&lo<=hi&&hi>0.00001&&lo<closest)closest=Math.max(0,lo);
 }return closest;
}
export class Navigation{
 constructor(world,spacing=1.5){
  this.world=world;this.spacing=spacing;this.nodes=[];this.cells=new Map();this.searches=0;this.links=0;
  for(let ix=-31;ix<=31;ix++)for(let iz=-31;iz<=31;iz++){
   const x=ix*spacing,z=iz*spacing,ys=[];
   for(const c of world.query(x,z,.01)){const contact=circleContact(c,x,z,.001);if(!contact?.inside)continue;const y=surfaceY(c,x,z);if(y<-.01||y>6.41||ys.some(v=>Math.abs(v-y)<.08))continue;
    if(world.clear(x,y+.31,z,BODY.crouch-.31,.31))ys.push(y);
   }
   const list=[];for(const y of ys){const node={id:this.nodes.length,x,y,z,ix,iz,low:!world.clear(x,y+.31,z,BODY.stand-.31,.31),edges:[]};this.nodes.push(node);list.push(node);}if(list.length)this.cells.set(ix+','+iz,list);
  }
  for(const n of this.nodes)for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])for(const b of this.cells.get((n.ix+dx)+','+(n.iz+dz))||[]){
   if(Math.abs(n.y-b.y)>1.25)continue;const low=this.walkable(n,b);if(low>=0)n.edges.push({to:b.id,cost:distance(n,b)*(low?1.3:1),kind:low?'crouch':'walk'});
  }
  // Authored, directional transfer: upper east terrace to the lower landing.
  this.addLink({x:23,y:3.2,z:3},{x:18,y:2.4,z:3},'jump');
  this.components();this.g=new Float64Array(this.nodes.length);this.parent=new Int32Array(this.nodes.length);this.closed=new Uint8Array(this.nodes.length);
  this.cover=this.nodes.filter(n=>!n.low&&n.edges.length>=3&&this.nearCover(n));
 }
 walkable(a,b,radius=.31){let y=a.y,low=a.low||b.low||false;const steps=Math.ceil(distance(a,b)/.18);for(let i=1;i<=steps;i++){
  const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,s=this.world.support(x,y,z,.325,.34);if(!s)return -1;y=s.y;
  if(!this.world.clear(x,y+.31,z,BODY.stand-.31,radius)){if(!this.world.clear(x,y+.31,z,BODY.crouch-.31,radius))return -1;low=true;}
 }return Math.abs(y-b.y)<.35?(low?1:0):-1;}
 addLink(a,b,kind){const n=this.nearest(a),m=this.nearest(b);if(!n||!m||Math.abs(n.y-a.y)>.4||Math.abs(m.y-b.y)>.4)return;n.edges.push({to:m.id,cost:distance(n,m)*1.15,kind});this.links++;}
 nearCover(n){for(const c of this.world.query(n.x,n.z,2.3)){if(c.bottom>n.y+1.6||surfaceY(c,n.x,n.z)<n.y+.9)continue;if(circleContact(c,n.x,n.z,2.3))return true;}return false;}
 components(){let id=0;for(const n of this.nodes){if(n.component!==undefined)continue;const q=[n];n.component=id;for(let i=0;i<q.length;i++)for(const e of q[i].edges){const b=this.nodes[e.to];if(b.component===undefined){b.component=id;q.push(b);}}id++;}this.componentCount=id;}
 nearest(p,component){let best=null,score=Infinity;for(const n of this.nodes){if(component!==undefined&&n.component!==component)continue;const d=(n.x-p.x)**2+(n.z-p.z)**2+((n.y-p.y)*3)**2;if(d<score){score=d;best=n;}}return best;}
 path(a,b,bias=0){const start=this.nearest(a),end=this.nearest(b,start?.component);if(!start||!end||distance(end,b)>5||Math.abs(end.y-b.y)>2)return[];this.searches++;const {g,parent,closed}=this;g.fill(Infinity);parent.fill(-1);closed.fill(0);g[start.id]=0;
  const heap=[];const push=(id,score)=>{let i=heap.length;heap.push({id,score});while(i){const p=(i-1)>>1;if(heap[p].score<=score)break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
  const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let j=i*2+1;if(j>=heap.length)break;if(j+1<heap.length&&heap[j+1].score<heap[j].score)j++;if(heap[i].score<=heap[j].score)break;[heap[i],heap[j]]=[heap[j],heap[i]];i=j;}}return first.id;};push(start.id,0);
  while(heap.length){const id=pop();if(closed[id])continue;closed[id]=1;if(id===end.id)break;const n=this.nodes[id];for(const e of n.edges){if(closed[e.to])continue;const m=this.nodes[e.to],cost=g[id]+e.cost*(1+.07*Math.sin(m.x*.13+m.z*.17+bias));if(cost<g[e.to]){g[e.to]=cost;parent[e.to]=id;push(e.to,cost+distance(m,end)*.9);}}}
  if(start!==end&&parent[end.id]<0)return[];const out=[];let id=end.id;while(id!==start.id&&id>=0){const n=this.nodes[id],prev=this.nodes[parent[id]],kind=prev.edges.find(e=>e.to===id).kind;out.push({...n,kind});id=parent[id];}out.reverse();return out;
 }
 destination(p,rng,min=10){const n=this.nearest(p);for(let i=0;i<120;i++){const b=this.nodes[Math.floor(rng()*this.nodes.length)];if(b.component===n.component&&distance(b,p)>min&&b.edges.length>=4&&!b.low)return b;}return n;}
 overwatch(p,threat,desired=20){const component=this.nearest(p).component,target={x:threat.x,y:threat.y+1.25,z:threat.z};let best=null,score=Infinity;for(const n of this.nodes){if(n.component!==component||n.low||n.y<p.y+1.4||n.edges.length<3)continue;const travel=distance(n,p),range=distance(n,threat);if(travel>38||range<7||range>38)continue;if(obstruction(this.world.colliders,{x:n.x,y:n.y+1.4,z:n.z},target)<.999)continue;const rank=travel+Math.abs(range-desired)*.35+(n.y-p.y)*1.2;if(rank<score){best=n;score=rank;}}return best;}
 coverFrom(p,threat,desired=14){let best=null,score=Infinity;const a={x:threat.x,y:threat.y+1.4,z:threat.z};for(const n of this.cover){const d=distance(n,p);if(d>18||d<1||Math.abs(n.y-p.y)>3.3)continue;const b={x:n.x,y:n.y+1.25,z:n.z};if(obstruction(this.world.colliders,a,b)>.985)continue;const s=d+Math.abs(distance(n,threat)-desired)*.3;if(s<score){best=n;score=s;}}return best;}
}
