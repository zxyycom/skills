import fs from 'node:fs';
import promises from 'node:fs/promises';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const git=[], files=[], directories=[], byteCopies={}, byteAllocations={};
const bufferFrom=Buffer.from;
Buffer.from=function(...args){
 if(args[0] instanceof Uint8Array){const stack=new Error().stack;const name=stack.split('\n').find(x=>!x.includes('counter.mjs') && !x.includes('node:') && x.includes('.ts:'))?.trim() ?? 'unmapped';const record=byteCopies[name]??={calls:0,bytes:0};record.calls++;record.bytes+=args[0].byteLength;}
 return bufferFrom.apply(this,args);
};
const bufferAlloc=Buffer.alloc;
Buffer.alloc=function(...args){
 if(args[0]>0){const stack=new Error().stack;const name=stack.split('\n').find(x=>!x.includes('counter.mjs') && !x.includes('node:') && x.includes('.ts:'))?.trim();if(name){const record=byteAllocations[name]??={calls:0,bytes:0};record.calls++;record.bytes+=args[0];}}
 return bufferAlloc.apply(this,args);
};
function observe(child,args){
 if(args[0]!=='git')return child;
 const record={argv:args[1].map(x=>x.startsWith(process.env.AUDIT_ROOT)?'<fixture>'+x.slice(process.env.AUDIT_ROOT.length):x),requests:0,unique:new Set(),outputBytes:0,payloadBytes:0,headerBytes:0,entries:0};git.push(record);
 let pending=Buffer.alloc(0),remaining=null;
 child.stdout?.on('data',chunk=>{
  record.outputBytes+=chunk.length;
  if(record.argv.includes('ls-files')||record.argv.includes('ls-tree'))for(const b of (Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)))if(b===0)record.entries++;
  if(!record.argv.includes('cat-file')||!record.argv.includes('--batch'))return;
  pending=Buffer.concat([pending,chunk]);
  while(pending.length){
   if(remaining===null){const end=pending.indexOf(10);if(end<0)return;const header=pending.subarray(0,end).toString();record.headerBytes+=end+1;pending=pending.subarray(end+1);const match=header.match(/^\S+ blob (\d+)$/);if(!match){remaining=-1;return;}remaining=Number(match[1]);}
   if(remaining<0)return;
   const consumed=Math.min(remaining,pending.length);record.payloadBytes+=consumed;remaining-=consumed;pending=pending.subarray(consumed);
   if(remaining===0){if(!pending.length)return;record.headerBytes++;pending=pending.subarray(1);remaining=null;}
  }
 });
 if(child.stdin){for(const name of ['write','end']){const original=child.stdin[name];child.stdin[name]=function(...values){if(record.argv.includes('cat-file')&&values[0]!=null){for(const id of String(values[0]).trim().split('\n'))if(id){record.requests++;record.unique.add(id);}}return original.apply(this,values);};}}
 return child;
}
for(const name of ['spawn','execFile']){const original=cp[name];cp[name]=function(...args){return observe(original.apply(this,args),args);};}
const read=promises.readFile;
promises.readFile=async function(...args){const value=await read.apply(this,args);const target=String(args[0]);if(target.startsWith(process.env.AUDIT_ROOT+'/'))files.push({path:target.slice(process.env.AUDIT_ROOT.length+1),bytes:Buffer.byteLength(value)});return value;};
const readdir=promises.readdir;
promises.readdir=async function(...args){const value=await readdir.apply(this,args);const target=String(args[0]);if(target.startsWith(process.env.AUDIT_ROOT+'/'))directories.push({path:target.slice(process.env.AUDIT_ROOT.length+1),entries:value.length});return value;};
syncBuiltinESMExports();
function sourceLocations(records){return Object.fromEntries(Object.entries(records).map(([key,value])=>[key.replace(/^.*(?=tools\/)/u,'').replace(/\)$/u,''),value]));}
process.on('exit',()=>fs.writeFileSync(process.env.AUDIT_OUTPUT,JSON.stringify({git:git.map(x=>({...x,unique:x.unique.size})),files,directories,byteCopies:sourceLocations(byteCopies),byteAllocations:sourceLocations(byteAllocations),cpuMicros:process.cpuUsage(),peakRSSKiB:process.resourceUsage().maxRSS})));
