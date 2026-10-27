// Time-based motion: the same degrees/second at 30, 60, or 120 Hz.
export function stickVelocity(value, deadzone = 0.13) {
  const magnitude = Math.min(1, Math.abs(value));
  return magnitude <= deadzone ? 0 : Math.sign(value) * (magnitude-deadzone)/(1-deadzone);
}
export function advanceAngle(angle, input, seconds, min, max, speed = 42) {
  return Math.max(min, Math.min(max, angle + stickVelocity(input)*speed*Math.min(0.05, Math.max(0,seconds))));
}
export function setupStick(pad, horizontal, vertical, {connected, getAngle, limits, pose, send, begin=()=>{}, end=()=>{}, raf=requestAnimationFrame, cancel=cancelAnimationFrame}) {
  const thumb=pad.querySelector('.stick-thumb');
  let pointer=null,dx=0,dy=0,frame=0,last=0,bounds;
  thumb.style.left='50%';thumb.style.top='50%';
  function update(e) {
    const radius=bounds.width*.33;
    let x=(e.clientX-bounds.left-bounds.width/2)/radius,y=(e.clientY-bounds.top-bounds.height/2)/radius;
    const norm=Math.max(1,Math.hypot(x,y));dx=x/norm;dy=y/norm;
    thumb.style.transform=`translate(calc(-50% + ${dx*radius}px),calc(-50% + ${dy*radius}px))`;
  }
  function tick(now) {
    frame=0;if(pointer===null)return;
    if(!connected()){stop();return;}
    const elapsed=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    for(const [axis,input] of [[horizontal,dx],[vertical,-dy]]) {
      const value=advanceAngle(getAngle(axis),input,elapsed,...limits(axis));
      if(value!==getAngle(axis)){pose(axis,value);send(axis,value);}
    }
    frame=raf(tick);
  }
  function stop() {
    if(pointer===null)return;
    const previous=pointer;pointer=null;dx=dy=0;cancel(frame);frame=0;
    thumb.style.transform='translate(-50%,-50%)';pad.classList.remove('active');
    if(pad.hasPointerCapture(previous))pad.releasePointerCapture(previous);
    end(horizontal);end(vertical);
  }
  pad.onpointerdown=e=>{if(pointer!==null||!connected())return;e.preventDefault();pointer=e.pointerId;bounds=pad.getBoundingClientRect();begin(horizontal);begin(vertical);pad.setPointerCapture(pointer);pad.classList.add('active');update(e);last=performance.now();frame=raf(tick);};
  pad.onpointermove=e=>{if(e.pointerId===pointer){e.preventDefault();update(e);}};
  pad.onpointerup=pad.onpointercancel=pad.onlostpointercapture=e=>{if(e.pointerId===pointer)stop();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('blur',stop);window.addEventListener('pagehide',stop);
  return stop;
}
