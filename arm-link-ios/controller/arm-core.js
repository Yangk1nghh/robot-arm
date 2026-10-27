// Shared, deterministic pose protocol. Angles are model joint angles in degrees.
export const INITIAL = [0, -22, 72, 0, 32, 20];
export const LIMITS = [[-180,180],[-90,90],[-120,120],[-180,180],[-90,90],[0,45]];
// Position of the wrist pivot in the concept model, measured from the base in mm.
const UPPER=125, FOREARM=105, SHOULDER_HEIGHT=85;
export function toolPosition(angles) {
  const yaw=angles[0]*Math.PI/180, shoulder=angles[1]*Math.PI/180, elbow=angles[2]*Math.PI/180;
  const radial=UPPER*Math.sin(shoulder)+FOREARM*Math.sin(shoulder+elbow);
  return {x:radial*Math.sin(yaw),y:SHOULDER_HEIGHT+UPPER*Math.cos(shoulder)+FOREARM*Math.cos(shoulder+elbow),z:radial*Math.cos(yaw)};
}
function targetAngles(x,y,z) {
  const radial=Math.hypot(x,z), vertical=y-SHOULDER_HEIGHT;
  const cosine=Math.max(-1,Math.min(1,(radial*radial+vertical*vertical-UPPER*UPPER-FOREARM*FOREARM)/(2*UPPER*FOREARM)));
  const elbow=Math.acos(cosine),shoulder=Math.atan2(radial,vertical)-Math.atan2(FOREARM*Math.sin(elbow),UPPER+FOREARM*Math.cos(elbow));
  return [Math.atan2(x,z)*180/Math.PI,shoulder*180/Math.PI,elbow*180/Math.PI];
}
function xyzPose(mode,elapsed) {
  const phase=elapsed*Math.PI*2/8000;
  const center={x:26,y:250,z:57},amplitude=16;
  const x=center.x+(mode==='xyz'||mode==='x'?amplitude*Math.sin(phase):0);
  const y=center.y+(mode==='xyz'?amplitude*Math.sin(phase+2*Math.PI/3):mode==='y'?amplitude*Math.sin(phase):0);
  const z=center.z+(mode==='xyz'?amplitude*Math.sin(phase+4*Math.PI/3):mode==='z'?amplitude*Math.sin(phase):0);
  return targetAngles(x,y,z);
}
export function validAngles(v) {
  return Array.isArray(v) && v.length === 6 && v.every((n,i) => Number.isFinite(n) && n >= LIMITS[i][0] && n <= LIMITS[i][1]);
}
export function initialState() { return { angles: [...INITIAL], steps: [], speed: 60, playback: null }; }
export function sample(state, now) {
  const p = state.playback;
  if (!p) return { angles: [...state.angles], playing: false, step: -1 };
  if (p.kind==='xyz') {
    const elapsed=Math.max(0,now-p.startedAt),goal=xyzPose(p.mode,Math.max(0,elapsed-1200));
    const blend=Math.min(1,elapsed/1200),ease=blend*blend*(3-2*blend);
    return {angles:p.from.map((v,i)=>i<3?v+(goal[i]-v)*ease:v),playing:true,step:-1,xyz:true};
  }
  let elapsed = Math.max(0, now - p.startedAt), from = p.from;
  for (let i=0;i<p.frames.length;i++) {
    const to = p.frames[i];
    const duration = Math.max(200, Math.max(...to.map((v,j)=>Math.abs(v-from[j]))) / p.speed * 1000);
    if (elapsed < duration) {
      const t = elapsed / duration;
      return { angles: to.map((v,j)=>from[j]+(v-from[j])*t), playing: true, step: i };
    }
    elapsed -= duration;
    if (elapsed < 400) return { angles: [...to], playing: true, step: i };
    elapsed -= 400; from = to;
  }
  return { angles: [...from], playing: false, step: p.frames.length-1 };
}
export function applyCommand(state, cmd, now) {
  if (!cmd || typeof cmd !== 'object') throw new Error('無效指令');
  const s = structuredClone(state);
  const current = sample(s, now).angles;
  switch (cmd.type) {
    case 'axis':
      if (!Number.isInteger(cmd.axis) || cmd.axis<0 || cmd.axis>5 || !Number.isFinite(cmd.value) || cmd.value<LIMITS[cmd.axis][0] || cmd.value>LIMITS[cmd.axis][1]) throw new Error('關節角度超出範圍');
      s.angles=current; s.angles[cmd.axis]=cmd.value; s.playback=null; break;
    case 'pose':
      if (!validAngles(cmd.angles)) throw new Error('無效姿態');
      s.angles=[...cmd.angles];s.playback=null;break;
    case 'save':
      if (s.steps.length>=50) throw new Error('最多可儲存 50 個姿態');
      s.steps.push(current);break;
    case 'play':
      if (!s.steps.length) throw new Error('請先儲存至少一個姿態');
      s.angles=current;s.playback={from:current,frames:structuredClone(s.steps),startedAt:now,speed:s.speed};break;
    case 'xyz':
      if (!['xyz','x','y','z'].includes(cmd.mode)) throw new Error('無效的 XYZ 軸');
      s.angles=current;s.playback={kind:'xyz',mode:cmd.mode,from:current,startedAt:now};break;
    case 'stop': s.angles=current;s.playback=null;break;
    case 'reset': s.angles=[...INITIAL];s.playback=null;break;
    case 'clear': s.angles=current;s.steps=[];s.playback=null;break;
    case 'speed':
      if (!Number.isFinite(cmd.value) || cmd.value<10 || cmd.value>180) throw new Error('速度需為 10～180°/秒');
      s.speed=cmd.value;break;
    default: throw new Error('不支援的指令');
  }
  return s;
}
