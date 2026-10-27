import { sample, toolPosition } from './arm-core.js';
import { createLocalAxes } from './optimistic.js';
export function createSync(render) {
  const status=document.querySelector('#syncStatus'),error=document.querySelector('#syncError');
  const inputs=[...document.querySelectorAll('#joints button,#speed,#xyzMode,#pitchRange,#gripRange')];
  const actions=[...document.querySelectorAll('#reset,.sequence-buttons button,#startXYZ,#stopXYZ')];
  const signIn=document.querySelector('#signIn');
  const local=createLocalAxes(),tickets=new WeakMap();
  let state=null,revision=-1,offset=0,queue=[],sending=false,scheduled=0,connected=false,closed=false,pollTimer;
  function enable(ok) { connected=ok; for(const c of [...inputs,...actions])c.disabled=!ok; }
  enable(false);
  function fail(message,login=false) {
    local.clear();enable(false);status.textContent=login?'需要登入':'同步中斷';error.textContent=message;error.hidden=false;signIn.hidden=!login;
  }
  async function api(command) {
    const begin=Date.now();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6000);
    try {
      const r=await fetch('/api/arm',{method:command?'POST':'GET',cache:'no-store',credentials:'same-origin',headers:command?{'Content-Type':'application/json'}:{},body:command?JSON.stringify(command):undefined,signal:controller.signal});
      const type=r.headers.get('content-type')||'';
      if(!type.includes('application/json'))throw Object.assign(new Error('請登入同一個 ChatGPT 帳號，再重新整理'),{login:true});
      const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error||'同步失敗'),{login:r.status===401});
      if(!data.state||!Number.isInteger(data.revision))throw new Error('同步資料格式不符');
      if(command?.type==='axis')local.acknowledge(command.axis,tickets.get(command));
      if(data.revision>=revision) {
        state=data.state;revision=data.revision;offset=data.serverTime-(begin+Date.now())/2;
        enable(true);error.hidden=true;signIn.hidden=true;status.textContent='● 已同步';
        document.querySelector('#speed').value=state.speed;document.querySelector('#speedValue').textContent=state.speed+'°/秒';
        const steps=document.querySelector('#steps');
        if(steps.dataset.count!==String(state.steps.length)) {
          steps.replaceChildren(...state.steps.map((angles,i)=>{const li=document.createElement('li');li.textContent=`姿態 ${i+1} · ${angles.map(v=>Math.round(v)+'°').join(' / ')}`;return li}));steps.dataset.count=state.steps.length;
        }
        render(local.merge(sample(state,Date.now()+offset).angles));
      }
    } finally {clearTimeout(timer);}
  }
  async function flush() {
    scheduled=0;if(sending||!queue.length||!connected)return;
    sending=true;
    try {let remaining=queue.length;while(queue.length&&remaining-->0) {const next=queue.shift();await api(next);}}
    catch(e) {queue=[];fail(e.name==='AbortError'?'連線逾時，正在重新連線…':e.message,e.login);}
    finally {sending=false;if(queue.length&&!scheduled)scheduled=setTimeout(flush,80);}
  }
  function command(cmd) {
    if(!connected)return;
    if(cmd.type==='axis') {
      tickets.set(cmd,local.set(cmd.axis,cmd.value));
      // Coalesce only the tail; preserve ordering around SAVE/PLAY/STOP commands.
      let k=queue.length-1;while(k>=0&&queue[k].type==='axis'){if(queue[k].axis===cmd.axis){queue[k]=cmd;break}k--}
      if(k<0||queue[k]?.type!=='axis')queue.push(cmd);
    } else queue.push(cmd);
    if(!scheduled&&!sending) scheduled=setTimeout(flush,80);
  }
  async function poll() {
    if(closed)return;
    if(!sending&&!queue.length) {
      try {await api();}catch(e){fail(e.name==='AbortError'?'連線逾時，正在重新連線…':e.message,e.login);}
    }
    pollTimer=setTimeout(poll,document.hidden?2500:500);
  }
  function animate() {
    if(closed)return;requestAnimationFrame(animate);
    if(!state)return;
    const pose=sample(state,Date.now()+offset);
    if(state.playback&&!queue.length&&!sending&&!local.busy())render(pose.angles);
    const position=toolPosition(pose.angles);
    document.querySelector('#xyzPosition').textContent=`X ${Math.round(position.x)} · Y ${Math.round(position.y)} · Z ${Math.round(position.z)} mm`;
    document.querySelector('#startXYZ').classList.toggle('active',!!pose.xyz);
    const count=state.steps.length;
    document.querySelector('#sequenceStatus').textContent=pose.xyz?`XYZ ${state.playback.mode.toUpperCase()} 自動運動中 · 已儲存 ${count} / 50 個姿態`:pose.playing?`播放姿態 ${pose.step+1} / ${count}`:`已儲存 ${count} / 50 個姿態`;
  }
  for(const [id,type] of [['savePose','save'],['playSequence','play'],['stopSequence','stop'],['clearSequence','clear']])document.querySelector('#'+id).onclick=()=>command({type});
  document.querySelector('#startXYZ').onclick=()=>command({type:'xyz',mode:document.querySelector('#xyzMode').value});
  document.querySelector('#stopXYZ').onclick=()=>command({type:'stop'});
  document.querySelector('#speed').onchange=e=>command({type:'speed',value:+e.target.value});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){clearTimeout(pollTimer);poll()}});
  window.addEventListener('pagehide',()=>{closed=true;clearTimeout(pollTimer)});
  window.addEventListener('pageshow',e=>{if(e.persisted){closed=false;poll();animate()}});
  poll();animate();
  return {command,connected:()=>connected,axis:(axis,value)=>command({type:'axis',axis,value}),beginAxis:(axis,value)=>local.begin(axis,value),endAxis:axis=>{local.end(axis);if(!sending&&queue.length){clearTimeout(scheduled);scheduled=0;flush();}}};
}
