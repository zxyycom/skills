import fs from 'node:fs';
import { isMainThread } from 'node:worker_threads';
const origin=process.hrtime.bigint();
const elapsed=()=>Number(process.hrtime.bigint()-origin)/1e6;
const events=[];const stack=[];
globalThis.__rpBegin=(label,metadata)=>{const id=events.length;events.push({id,label,metadata,parent:stack.at(-1)??null,startMs:elapsed()});stack.push(id);return id;};
globalThis.__rpEnd=(id)=>{events[id].endMs=elapsed();if(stack.pop()!==id)throw new Error('instrumentation nesting violated');};
if(isMainThread)process.on('exit',()=>fs.writeFileSync(process.env.RECORD_PHASE_TRACE,JSON.stringify({pid:process.pid,elapsedMs:elapsed(),open:stack,events})+'\n'));
