// Keep local input until its own request is acknowledged, even if older GETs finish later.
export function createLocalAxes() {
  let serial=0;const pending=new Map(),held=new Set(),values=new Map();
  return {
    begin(axis,value){held.add(axis);if(Number.isFinite(value))values.set(axis,value);},
    end(axis){held.delete(axis);if(!pending.has(axis))values.delete(axis);},
    set(axis,value){const ticket=++serial;pending.set(axis,ticket);values.set(axis,value);return ticket;},
    acknowledge(axis,ticket){if(pending.get(axis)!==ticket)return;pending.delete(axis);if(!held.has(axis))values.delete(axis);},
    merge(remote){const result=[...remote];values.forEach((value,axis)=>{result[axis]=value;});return result;},
    busy(){return values.size>0;},
    clear(){pending.clear();held.clear();values.clear();}
  };
}
