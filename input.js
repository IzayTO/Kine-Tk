import {clamp} from './physics.js';
const capture=(element,id)=>{try{element.setPointerCapture(id);}catch{/* A cancelled pointer may already have left the document. */}};
export class Input {
  constructor(canvas,params,onPause,onReset){
    this.canvas=canvas;this.params=params;this.keys=new Set();this.x=0;this.z=0;
    this.yaw=0;this.pitch=0;this.active=false;this.touchMode=matchMedia('(pointer: coarse)').matches;
    this.fire=false;this.aim=false;this.sprintToggle=false;this.aimToggle=false;this.crouchToggle=false;
    this.jumpQueued=false;this.slideQueued=false;this.touchMove={x:0,z:0};this.lookDX=0;this.lookDY=0;
    this.joystickId=null;this.lookId=null;this.firePointers=new Set();this.buttons=new Map();this.actions=[];this.fireQueued=false;this.preferences=null;this.onAssist=null;
    this.joy=document.querySelector('#joystick');this.knob=document.querySelector('#stick');
    this.lookArea=document.querySelector('#look-area');
    document.body.classList.toggle('touch',this.touchMode);
    window.addEventListener('keydown',e=>{
      if(e.target.matches('input,select,textarea'))return;
      if(['Space','ControlLeft','ControlRight','ArrowUp','ArrowDown','Tab'].includes(e.code))e.preventDefault();
      if(e.code==='Escape'){onPause();return;}
      if(e.code==='KeyP'||e.code==='Tab'){e.preventDefault();onPause(true);return;}
      if(!this.active)return;
      if(e.code==='Home'&&!e.repeat)onReset();
      const action={KeyR:'reload',KeyQ:'ping',KeyB:'mode',KeyH:'assist',Digit1:'slot0',Digit2:'slot1',Digit3:'slot2'}[e.code];if(action&&!e.repeat)this.actions.push(action);
      if(e.code==='Space'&&!e.repeat)this.jumpQueued=true;
      if(['KeyC','ControlLeft','ControlRight'].includes(e.code)&&!e.repeat)this.slideQueued=true;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>{this.clear();if(this.active)onPause();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();onPause();}});
    document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&this.active&&!this.touchMode)onPause();});
    document.addEventListener('mousemove',e=>{if(this.active&&document.pointerLockElement===canvas)this.look(e.movementX,e.movementY,false);});
    canvas.addEventListener('mousedown',e=>{if(!this.active)return;if(e.button===0){this.fire=true;this.fireQueued=true;}if(e.button===2)this.aim=true;});
    window.addEventListener('mouseup',e=>{if(e.button===0)this.fire=false;if(e.button===2)this.aim=false;});
    document.addEventListener('contextmenu',e=>e.preventDefault());
    this.joy.addEventListener('pointerdown',e=>{
      if(!this.active||this.joystickId!==null)return;e.preventDefault();this.joystickId=e.pointerId;
      capture(this.joy,e.pointerId);const r=this.joy.getBoundingClientRect();this.joyCenter={x:r.left+r.width/2,y:r.top+r.height/2,r:r.width*0.34};this.moveStick(e);
    });
    this.joy.addEventListener('pointermove',e=>{if(e.pointerId===this.joystickId)this.moveStick(e);});
    const releaseStick=e=>{if(e.pointerId===this.joystickId){this.joystickId=null;this.touchMove.x=0;this.touchMove.z=0;this.knob.style.transform='translate(-50%, -50%)';}};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])this.joy.addEventListener(name,releaseStick);
    this.lookArea.addEventListener('pointerdown',e=>{
      if(!this.active||this.lookId!==null)return;e.preventDefault();this.lookId=e.pointerId;
      this.lastLook={x:e.clientX,y:e.clientY};capture(this.lookArea,e.pointerId);
    });
    this.lookArea.addEventListener('pointermove',e=>{if(e.pointerId!==this.lookId)return;
      this.look(e.clientX-this.lastLook.x,e.clientY-this.lastLook.y,true);this.lastLook={x:e.clientX,y:e.clientY};});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])this.lookArea.addEventListener(name,e=>{if(e.pointerId===this.lookId)this.lookId=null;});
    for(const button of document.querySelectorAll('[data-action]')){
      const action=button.dataset.action;
      button.addEventListener('pointerdown',e=>{
        if(!this.active)return;e.preventDefault();e.stopPropagation();capture(button,e.pointerId);this.buttons.set(e.pointerId,action);
        button.classList.add('pressed');
        if(['reload','ping','assist','mode','slot0','slot1','slot2'].includes(action))this.actions.push(action);
        if(action==='jump'){this.jumpQueued=true;this.crouchToggle=false;}
        if(action==='slide'){this.slideQueued=this.params.contextualSlide&&(this.speed||0)>=5.4;if(!this.params.contextualSlide || (this.speed||0)<5.4)this.crouchToggle=!this.crouchToggle;else this.crouchToggle=false;}
        if(action==='sprint'){this.sprintToggle=!this.sprintToggle;this.crouchToggle=false;button.classList.toggle('selected',this.sprintToggle);}
        if(action==='aim'){this.aimToggle=!this.aimToggle;button.classList.toggle('selected',this.aimToggle);}
        if(action==='fire'){this.fireQueued=true;this.firePointers.add(e.pointerId);this.fireOrigins??=new Map();this.fireOrigins.set(e.pointerId,{x:e.clientX,y:e.clientY});}
      });
      // Drag on FIRE also aims, freeing a thumb for jump/slide combinations.
      button.addEventListener('pointermove',e=>{
        if(action!=='fire'||!this.firePointers.has(e.pointerId))return;
        const last=this.fireOrigins.get(e.pointerId);this.look(e.clientX-last.x,e.clientY-last.y,true);this.fireOrigins.set(e.pointerId,{x:e.clientX,y:e.clientY});
      });
      const end=e=>{this.buttons.delete(e.pointerId);this.firePointers.delete(e.pointerId);this.fireOrigins?.delete(e.pointerId);button.classList.remove('pressed');};
      for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,end);
    }
    // Prevent Safari page gestures while the game owns a multitouch gesture.
    document.querySelector('#touch-controls').addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  }
  look(dx,dy,touch){
    if(!this.active)return;
    const p=this.preferences,source=touch?'touch':'mouse',ads=this.aim||this.aimToggle?(p?.[source+'ADS']??0.7):1;
    const scale=(touch?0.0030:0.0018)*this.params.sensitivity*ads;
    let dyaw=-dx*scale*(p?.[source+'X']??1),dpitch=-dy*scale*(p?.[source+'Y']??1)*(p?.invertY?-1:1);
    if(this.onAssist&&p?.assist&&(touch||p.assistMouse))[dyaw,dpitch]=this.onAssist(this.yaw,this.pitch,dyaw,dpitch);
    this.yaw+=dyaw;this.pitch=clamp(this.pitch+dpitch,-1.48,1.48);
    this.lookDX=dx;this.lookDY=dy;
  }
  moveStick(e){
    const c=this.joyCenter;let dx=(e.clientX-c.x)/c.r,dy=(e.clientY-c.y)/c.r;const len=Math.hypot(dx,dy);
    if(len>1){dx/=len;dy/=len;}const mag=Math.min(1,len);
    const mapped=mag<0.12?0:(mag-0.12)/0.88;
    this.touchMove.x=mag?dx*mapped/mag:0;this.touchMove.z=mag?dy*mapped/mag:0;
    const visualScale=this.joy.getBoundingClientRect().width/this.joy.clientWidth||1;
    this.knob.style.transform=`translate(calc(-50% + ${dx*c.r/visualScale}px), calc(-50% + ${dy*c.r/visualScale}px))`;
  }
  sample(consume=true){
    const k=this.keys;
    let x=this.touchMove.x+(k.has('KeyD')?1:0)-(k.has('KeyA')?1:0);
    let z=this.touchMove.z+(k.has('KeyS')?1:0)-(k.has('KeyW')?1:0);
    const l=Math.hypot(x,z);if(l>1){x/=l;z/=l;}
    const jump=this.jumpQueued,slide=this.slideQueued;if(consume){this.jumpQueued=false;this.slideQueued=false;}
    const fireStart=this.fireQueued,actions=consume?this.actions.splice(0):this.actions.slice();if(consume)this.fireQueued=false;
    this.x=x;this.z=z;
    return {x,z,fireStart,actions,yaw:this.yaw,pitch:this.pitch,jump,slide,
      crouch:this.crouchToggle||k.has('KeyC')||k.has('ControlLeft')||k.has('ControlRight'),
      sprint:this.sprintToggle||k.has('ShiftLeft')||k.has('ShiftRight')||(this.params.autoSprint&&l>0.86),
      walk:k.has('AltLeft')||k.has('AltRight'),aim:this.aim||this.aimToggle,fire:this.fire||this.firePointers.size>0,
      lookDX:this.lookDX,lookDY:this.lookDY};
  }
  clear(){
    this.actions.length=0;this.fireQueued=false;
    this.keys.clear();this.fire=false;this.aim=false;this.aimToggle=false;this.sprintToggle=false;this.crouchToggle=false;
    this.touchMove={x:0,z:0};this.joystickId=null;this.lookId=null;this.firePointers.clear();this.buttons.clear();
    this.jumpQueued=false;this.slideQueued=false;this.lookDX=0;this.lookDY=0;
    if(this.knob)this.knob.style.transform='translate(-50%, -50%)';
    document.querySelectorAll('[data-action]').forEach(b=>b.classList.remove('pressed','selected'));
  }
}
