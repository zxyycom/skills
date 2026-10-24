import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';
const base='/tmp/record-reader-experiment-1adb9846';
const countOps = (sync, driftTarget) => {
  const counts={}; const inc=n=>counts[n]=(counts[n]??0)+1;
  let mutated=false;
  const drift=()=>{if(driftTarget&&!mutated){mutated=true;fs.writeFileSync(driftTarget,'replacement revision that is a different size\n');}};
  if(sync){
    for(const n of ['realpathSync','lstatSync','openSync','fstatSync','readFileSync','closeSync']) {
      const old=fs[n]; fs[n]=function(...args){inc(n.replace('Sync',''));const result=old.apply(this,args);if(n==='readFileSync'&&typeof args[0]==='number')drift();return result;};
    }
  } else {
    for(const n of ['realpath','lstat','open']) {
      const old=fsp[n];fsp[n]=async function(...args){inc(n);const result=await old.apply(this,args);if(n==='open')for(const h of ['stat','readFile','close']){const oldh=result[h].bind(result);result[h]=async(...xs)=>{inc(h==='stat'?'fstat':h);const v=await oldh(...xs);if(h==='readFile')drift();return v;};}return result;};
    }
  }
  return counts;
};
async function load(sync){
  const suffix=sync?'.sync.ts':'.ts';
  const dir=base+'/source/tools/record-operations/src/';
  return {text:(await import(pathToFileURL(dir+'source'+suffix))).readRecordText,snapshot:(await import(pathToFileURL(dir+'transaction-snapshot'+suffix))).readRecordTextSnapshot};
}
async function batch(args,sync){
  const loadStart=performance.now();const readers=await load(sync); const importMs=performance.now()-loadStart;
  const counts=args.instrument||args.driftTarget?countOps(sync,args.driftTarget):{};
  const start=performance.now();const results=new Array(args.paths.length);let cursor=0;
  const runOne=i=>readers[args.contract](args.root,args.contract==='text'?args.paths[i]:path.resolve(args.root,args.paths[i]));
  if(sync){for(let i=0;i<results.length;i++)results[i]=runOne(i);}
  else {await Promise.all(Array.from({length:args.concurrency??1},async()=>{for(;;){const i=cursor++;if(i>=results.length)return;results[i]=await runOne(i);}}));}
  return {results,counts,importMs,workMs:performance.now()-start};
}
export async function execute(args){
  const cpu=process.cpuUsage();const start=performance.now();let maxLagMs=0;let previous=start;
  const timer=setInterval(()=>{const now=performance.now();maxLagMs=Math.max(maxLagMs,now-previous-5);previous=now;},5);
  let output,onlineMs=null,receivedMs=null;
  try {
    if(args.model==='C'){
      output=await new Promise((resolve,reject)=>{
        const worker=new Worker(new URL(import.meta.url),{workerData:args});let message;
        worker.on('online',()=>onlineMs=performance.now()-start);
        worker.on('message',m=>{receivedMs=performance.now()-start;message=m;});
        worker.on('error',reject);worker.on('exit',code=>{if(code!==0)reject(new Error('worker exit '+code));else if(message?.error)reject(new Error(message.error));else resolve(message);});
      });
    } else output=await batch(args,false);
  } finally {clearInterval(timer);}
  const wallMs=performance.now()-start;const used=process.cpuUsage(cpu);const usage=process.resourceUsage();
  return {...output,metrics:{wallMs,userMs:used.user/1000,systemMs:used.system/1000,maxRSSKiB:usage.maxRSS,maxLagMs,onlineMs,receivedMs,workerWorkMs:args.model==='C'?output.workMs:null,workerImportMs:args.model==='C'?output.importMs:null}};
}
function summarize(results,contract,paths){
  const hash=createHash('sha256');let bytes=0;for(let i=0;i<results.length;i++){
    const r=results[i];const b=contract==='text'?Buffer.from(r):Buffer.from(r.snapshot.bytes);bytes+=b.length;
    hash.update(paths[i]+'\0').update(b);
    if(contract!=='text')hash.update(JSON.stringify({root:r.root,path:r.path,text:r.text,dev:r.snapshot.dev,ino:r.snapshot.ino,mode:r.snapshot.mode,parents:r.snapshot.parents}));
  }return {count:results.length,bytes,resultSHA256:hash.digest('hex')};
}
if(!isMainThread){try{parentPort.postMessage(await batch(workerData,true));}catch(error){parentPort.postMessage({error:String(error)});}finally{parentPort.close();}}
else if(process.argv[1]===new URL(import.meta.url).pathname){
  const [model='A',contract='text',n='1000',instrument='false']=process.argv.slice(2);
  const manifest=JSON.parse(fs.readFileSync(base+'/fixture-manifest.json','utf8'));
  const paths=manifest.files.slice(0,+n).map(f=>f.path);const args={model,contract,paths,root:manifest.root,instrument:instrument==='true',concurrency:model==='B4'?4:model==='B8'?8:1};
  const out=await execute(args); const summary=summarize(out.results,contract,paths);
  // Independent per-file posterior: content bytes/hash, snapshot handle identity/mode/parents, strict text decode.
  for(let i=0;i<paths.length;i++){
    const f=manifest.files[i],r=out.results[i],b=Buffer.from(contract==='text'?r:r.snapshot.bytes);
    if(createHash('sha256').update(b).digest('hex')!==f.sha256)throw new Error('bytes mismatch '+f.path);
    if(contract==='snapshot'){
      if(r.text!==new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b)||r.snapshot.dev!==f.dev||r.snapshot.ino!==f.ino||r.snapshot.mode!==f.mode)throw new Error('snapshot facts mismatch '+f.path);
      const dirs=[manifest.root,...(f.path.includes('/')?[path.join(manifest.root,'archive')]:[])];
      if(JSON.stringify(r.snapshot.parents)!==JSON.stringify(dirs.map(d=>{const s=fs.lstatSync(d);return {dev:s.dev,ino:s.ino};})))throw new Error('parent facts mismatch '+f.path);
    }
  }
  console.log(JSON.stringify({args:{...args,paths:undefined},summary,posterior:true,metrics:out.metrics,counts:out.counts,readerImportMs:out.importMs,readerWorkMs:out.workMs,node:process.version,uvThreadpoolSize:process.env.UV_THREADPOOL_SIZE??'default'}));
}
