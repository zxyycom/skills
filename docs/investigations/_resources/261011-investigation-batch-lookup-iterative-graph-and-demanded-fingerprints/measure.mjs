// Run with fixed Bun: bun <script> <repository-root> <revision|workspace> <new-output-json>
// Sources are read-only. Only this run's private temporary Node module is created and removed.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {Hash,createHash} from 'node:crypto';
const [rootArg,revision,output]=process.argv.slice(2);
if(!rootArg||!revision||!output) throw new Error('Expected root, revision|workspace, and new output JSON');
const root=path.resolve(rootArg),transpiler=new Bun.Transpiler({loader:'ts'});
const consumedSources=new Map();
async function source(relative){if(!consumedSources.has(relative))consumedSources.set(relative,revision==='workspace'?await fs.readFile(path.join(root,relative),'utf8'):execFileSync('git',['-C',root,'show',`${revision}:${relative}`],{encoding:'utf8'}));return consumedSources.get(relative);}
function javascript(text,relative){return transpiler.transformSync(text).replace(/(from\s+)(["'])(\.[^"']+)\2/g,(_,prefix,quote,target)=>prefix+JSON.stringify(pathToFileURL(path.resolve(root,path.dirname(relative),target)).href));}
async function module(relative){return await import('data:text/javascript;base64,'+Buffer.from(javascript(await source(relative),relative)).toString('base64'));}
const selectors=await module('tools/investigation-report/src/staging-selectors.ts');
const blob=await module('tools/shared/src/version-control/git-blob-batch.ts');
const graph=await module('tools/shared/src/graph/relations.ts');
const discoverySource=await source('tools/investigation-report/src/investigation-index-source.ts');
const discoveryText=discoverySource.slice(discoverySource.indexOf('function resolveDiscoveredSources('),discoverySource.indexOf('async function readIndexedInvestigationSource('));
const discovery=await import('data:text/javascript;base64,'+Buffer.from(transpiler.transformSync(discoveryText+'\nexport {resolveDiscoveredSources};')).toString('base64'));
const results={revision,bunVersion:Bun.version,bunCompatibilityProcessVersion:process.version,selectors:[],discovery:[],hash:[],nodeGraph:null,safeGraph:null};
for(const N of [20,200])for(const Kname of [1,20]){
 const workspace={entries:Object.fromEntries(Array.from({length:N},(_,i)=>[`261011-name-${i}`,{name:`name-${i}`}]))};
 const iterator=Map.prototype[Symbol.iterator],get=Map.prototype.get,set=Map.prototype.set;
 let entryYields=0,gets=0,sets=0;
 Map.prototype[Symbol.iterator]=function*(){for(const item of iterator.call(this)){entryYields++;yield item;}};
 Map.prototype.get=function(key){gets++;return get.call(this,key);};
 Map.prototype.set=function(key,value){sets++;return set.call(this,key,value);};
 let result;try{result=selectors.resolveInvestigationStageSelectors({baseline:null,workspace,selectedIds:Array.from({length:Kname},(_,i)=>`name-${i}`)});}finally{Map.prototype[Symbol.iterator]=iterator;Map.prototype.get=get;Map.prototype.set=set;}
 results.selectors.push({N,Kname,entryYields,mapGets:gets,mapSets:sets,status:result.status,selected:result.value?.length});
}
for(const N of [20,200])for(const Ku of [1,20]){
 let itemReads=0,gets=0,sets=0;
 const formalSources=new Proxy(Array.from({length:N},(_,i)=>({id:`id-${i}`,sourcePath:`id-${i}.md`,text:'payload'})),{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))itemReads++;return Reflect.get(target,key,receiver);}});
 const get=Map.prototype.get,set=Map.prototype.set;
 Map.prototype.get=function(key){gets++;return get.call(this,key);};
 Map.prototype.set=function(key,value){sets++;return set.call(this,key,value);};
 let result;try{result=discovery.resolveDiscoveredSources({formalSources},Array.from({length:Ku},(_,i)=>`id-${i}`));}finally{Map.prototype.get=get;Map.prototype.set=set;}
 results.discovery.push({N,Ku,sourceElementReads:itemReads,mapGets:gets,mapSets:sets,resolved:result.length});
}
for(const mode of ['none','sha256'])for(const retention of [null,16384,0]){
 const descriptor=Object.getOwnPropertyDescriptor(Hash.prototype,'update');
 let bytes=0,calls=0;
 Object.defineProperty(Hash.prototype,'update',{...descriptor,value:function(data,...args){bytes+=data.byteLength;calls++;return Reflect.apply(descriptor.value,this,[data,...args]);}});
 const id='a'.repeat(40),data=Buffer.alloc(1024*1024,120),reader=new blob.GitBlobBatchReader(new Map([[id,retention]]),mode);
 const header=Buffer.from(`${id} blob ${data.length}\n`);let result;
 try{reader.consume(header);reader.consume(data);reader.consume(Buffer.from('\n'));result=reader.finish();}finally{Object.defineProperty(Hash.prototype,'update',descriptor);}
 results.hash.push({mode,retention,payloadBytes:data.length,framingBytes:header.length+1,handedToReaderBytes:header.length+data.length+1,hashUpdateBytes:bytes,hashUpdateCalls:calls,retainedBytes:result.get(id).data.length});
}
let seed=71838;const fixtures=[];
for(let sample=0;sample<200;sample++){
 const ids=Array.from({length:10},(_,i)=>`node-${i}`),edges=[];
 for(let i=0;i<30;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const source=ids[seed%10];seed=(Math.imul(seed,1664525)+1013904223)>>>0;const target=[...ids,'missing'][seed%11];edges.push({source,target,type:i%2?'review':'revision'});}
 fixtures.push(graph.relationGraphStructuralIssues(graph.buildRelationGraph([...ids].reverse(),edges)));
}
results.safeGraph={samples:200,initialSeed:71838,structuralIssueDigest:createHash('sha256').update(JSON.stringify(fixtures)).digest('hex')};
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'investigation-graph-probe-'));
try{
 const target=path.join(temp,'graph.mjs');await fs.writeFile(target,javascript(await source('tools/shared/src/graph/relations.ts'),'tools/shared/src/graph/relations.ts'));
 const program=`import {buildRelationGraph,relationGraphStructuralIssues} from ${JSON.stringify(pathToFileURL(target).href)};
 const results=[];for(const V of [1000,3000,6000,10000]){const ids=Array.from({length:V},(_,i)=>String(i).padStart(5,'0'));const g=buildRelationGraph(ids,ids.slice(1).map((target,i)=>({source:ids[i],target,type:'review'})));try{results.push({V,E:V-1,issues:relationGraphStructuralIssues(g).length});}catch(error){results.push({V,E:V-1,error:error.message});}}console.log(JSON.stringify({runtime:process.version,results}));`;
 results.nodeGraph=JSON.parse(execFileSync('node',['--input-type=module','-e',program],{encoding:'utf8'}));
}finally{await fs.rm(temp,{recursive:true,force:true});}
results.sourceFingerprints=Object.fromEntries([...consumedSources].map(([relative,text])=>[relative,createHash('sha256').update(text).digest('hex')]));
results.observedAt=new Date().toISOString();
await fs.writeFile(path.resolve(output),JSON.stringify(results,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,revision}));
