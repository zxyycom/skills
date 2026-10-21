// Read-only production-code probe. All fixture and output writes go to one mkdtemp.
// Usage: node decision-probe.mjs <repository-root> [established-count=12] [operations=all] [index-only]
// Requires the repository's existing Node-compatible dependencies; installs nothing.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Session } from 'node:inspector/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const repo=path.resolve(process.argv[2]??process.cwd());
const n=Number(process.argv[3]??12);
const indexOnly=process.argv[5]==='index-only';
const candidates=indexOnly?0:3;
const wanted=process.argv[4]??'all';
if(!Number.isSafeInteger(n)||n<4)throw Error('established-count must be an integer >= 4');
Error.stackTraceLimit=30;
const imp=(f)=>import(`${repo}/tools/decision-records/src/${f}.ts`);
const {serializeDecisionFrontmatter}=await imp('decision-metadata');
const {syncDecisionIndex,buildDecisionIndexFromSnapshot,serializeDecisionIndex,decisionSourceRevision,decisionIndexState}=await imp('decision-state-index');
const {executeDecisionQuery}=await imp('decision-query-service');
const {scanDecisionRecords}=await imp('scan');
const {createDecisionCandidate}=await imp('decision-candidate-service');
const {prepareDecisionLifecycle}=await imp('decision-lifecycle-service');
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'decision-audit-'));
const root=path.join(scratch,'fixture');
const directory=path.join(root,'docs/decisions');
await fs.mkdir(directory,{recursive:true});
const id=(i)=>`261021-entry-${String(i).padStart(4,'0')}`;
const projection={title:'隔离实验记录',purpose:'保留事实',background:'受控合成',decision:'采用样例',relations:[]};
const body='## 目的\n\n隔离实验。\n\n## 背景\n\n受控合成。\n\n## 决策\n\n- 采用：保留样例。\n';
const states={}, sources=[];
for(let i=0;i<n+candidates;i++){
 const candidate=i>=n;
 const metadata={status:candidate?'candidate':'active',alignment:candidate?null:'aligned',createdAt:candidate?null:'2026-10-21T00:00:00Z'};
 const sourcePath=`entry-${String(i).padStart(4,'0')}.md`;
 const text=serializeDecisionFrontmatter(id(i),projection,['audit'],metadata)+body;
 if(indexOnly){sources.push({decisionId:id(i),sourcePath,text});states[id(i)]=decisionIndexState(sourcePath,{...projection,...metadata,tags:['audit']},id(i));}
 else await fs.writeFile(path.join(directory,sourcePath),text);
}
if(indexOnly){
 const built=await buildDecisionIndexFromSnapshot({metadata:{},states,sourceRevision:decisionSourceRevision(sources)});
 if(built.status!=='ok')throw Error(JSON.stringify(built));
 await fs.writeFile(path.join(directory,'decision-index.json'),serializeDecisionIndex(built.value));
}else{
 const seeded=await syncDecisionIndex({decisionsDirectory:directory,mode:'write'});
 if(seeded.status!=='ok')throw Error(JSON.stringify(seeded));
}
const location={workspaceRoot:root,decisionsDir:'docs/decisions'};
let active=null;
const original={};
const normalize=(s)=>s.replaceAll(repo+'/', '').replaceAll(root,'<fixture>').replaceAll(scratch,'<scratch>');
for(const method of ['readFile','readdir','lstat','stat']){
 original[method]=fs[method];
 fs[method]=function(...args){
  if(active){const stack=new Error().stack.split('\n').slice(2).filter(l=>l.includes('/tools/')).map(l=>normalize(l.trim()));active.io.push({method,path:path.relative(root,String(args[0])),stack});}
  return original[method].apply(this,args);
 };
}
const originalParse=JSON.parse;
JSON.parse=function(...args){
 if(active){const stack=new Error().stack.split('\n').slice(2).filter(l=>l.includes('/tools/')).map(l=>normalize(l.trim()));if(stack.length)active.json.push({stack});}
 return originalParse.apply(this,args);
};
const session=new Session();session.connect();await session.post('Profiler.enable');
const base={location},filters={alignment:'all',status:'all',tags:[]};
const operations={
 scan:()=>scanDecisionRecords({workspaceRoot:root}),
 check:()=>executeDecisionQuery({...base,command:'check'}),
 candidates:()=>executeDecisionQuery({...base,command:'candidates'}),
 'show-candidate':()=>executeDecisionQuery({...base,command:'show-candidate',decisionId:id(n)}),
 show:()=>executeDecisionQuery({...base,command:'show',decisionId:id(0)}),
 list:()=>executeDecisionQuery({...base,...filters,command:'list',limit:20,offset:0}),
 trace:()=>executeDecisionQuery({...base,command:'trace',decisionId:id(0)}),
 'trace-name':()=>executeDecisionQuery({...base,command:'trace',decisionId:'entry-0000'}),
 'metadata-search':()=>executeDecisionQuery({...base,...filters,command:'search',in:'metadata',text:'样例',match:'all'}),
 'content-search':()=>executeDecisionQuery({...base,...filters,command:'search',in:'content',text:'样例',match:'all'}),
 'sync-preview':()=>executeDecisionQuery({...base,command:'sync-index',preflight:true}),
 'sync-selected-preview':()=>executeDecisionQuery({...base,command:'sync-index',preflight:true,selectors:[id(0)]}),
 'maintenance-prepare':async()=>{const scan=await scanDecisionRecords({workspaceRoot:root});return prepareDecisionLifecycle(scan,{action:'set-relations',preflight:true,relationOverrideGroups:[{source:id(0),relationOverride:{kind:'replace',relations:[]}}]},{historyBaseline:null});},
 'new-many':()=>createDecisionCandidate({workspaceRoot:root,decisionId:'new-many-entry',...projection,tags:['audit'],relations:Array.from({length:4},(_,i)=>({type:'修订',target:`entry-${String(n-1-i).padStart(4,'0')}`})),relationSummaries:Array.from({length:4},(_,i)=>({target:`entry-${String(n-1-i).padStart(4,'0')}`,summary:'关联依据'}))})
};
const selectedSyncFunctions=new Set(['parseYamlFrontmatter','parseDecisionMarkdown','decisionIdFromMarkdown','isCandidateDecisionMarkdown','selectEstablishedDecisionIds','decisionValidationSummary','parseDecisionIndexState','decisionTimestampMilliseconds','compareRecentDecisionRecords','compareEntries','effectiveEntries','resolveDecisionRelationSelector']);
const observations=[];
for(const [operation,run]of Object.entries(operations)){
 if(wanted!=='all'&&!wanted.split(',').includes(operation))continue;
 if(indexOnly&&!['list','trace','trace-name','metadata-search'].includes(operation))throw Error('index-only supports published snapshot queries only');
 const metrics={io:[],json:[]};await session.post('Profiler.startPreciseCoverage',{callCount:true,detailed:false});active=metrics;
 const result=await run();active=null;
 const coverage=await session.post('Profiler.takePreciseCoverage');await session.post('Profiler.stopPreciseCoverage');
 const calls={};
 for(const script of coverage.result){
  if(!script.url.startsWith(`file://${repo}/tools/`))continue;
  const filename=fileURLToPath(script.url),relative=path.relative(repo,filename);
  let source;
  for(const fn of script.functions){
   const count=fn.ranges[0]?.count??0;if(!count)continue;
   if(selectedSyncFunctions.has(fn.functionName))calls[`${relative}#${fn.functionName}`]=count;
   else if(relative==='tools/index-runtime/src/reader.ts'&&fn.functionName==='query')calls[`${relative}#query`]=count;
   else if(fn.functionName===''&&['tools/decision-records/src/decision-candidate-service.ts','tools/decision-records/src/decision-candidate-validation.ts'].includes(relative)){
    source??=await original.readFile(filename,'utf8');const line=source.slice(0,fn.ranges[0].startOffset).split('\n').length;
    if([191,198,63,98].includes(line))calls[`${relative}#callback@${line}`]=count;
   }
  }
 }
 const fileReads={markdown:0,json:0,scan:0,snapshotBuild:0,revisionGuard:0,target:0};
 const groups={};
 for(const e of metrics.io){
  if(e.method!=='readFile')continue;
  const kind=e.path.endsWith('.md')?'markdown':e.path.endsWith('.json')?'json':null;if(kind)fileReads[kind]++;
  if(kind==='markdown'){
   if(e.stack.some(s=>s.includes('validateSourceMembership')))fileReads.scan++;
   else if(e.stack.some(s=>s.includes('readDecisionStateSnapshot')))fileReads.snapshotBuild++;
   else if(e.stack.some(s=>s.includes('readDecisionSourceRevision')))fileReads.revisionGuard++;
   else if(e.stack.some(s=>s.includes('readDecisionBody')))fileReads.target++;
  }
  const key=e.stack.join('\n');groups[key]=(groups[key]??0)+1;
 }
 const jsonGroups={};for(const e of metrics.json){const key=e.stack.join('\n');jsonGroups[key]=(jsonGroups[key]??0)+1;}
 observations.push({operation,status:result.status??'scan',sourceErrors:result.sourceErrors??result.errors??[],fileReads,jsonParseCalls:metrics.json.length,synchronousCalls:calls,readFileStackGroups:groups,jsonParseStackGroups:jsonGroups});
}
await session.post('Profiler.disable');session.disconnect();for(const method of Object.keys(original))fs[method]=original[method];JSON.parse=originalParse;
const output={baselineHead:execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,fixture:{established:n,candidates,indexOnly},method:'fs/promises readFile and JSON.parse wrappers; V8 precise coverage for a whitelist of synchronous functions only. No timings. FileHandle.read used by content matching is not included in readFile totals.',observations};
const outputFile=path.join(scratch,'decision-observations.json');await fs.writeFile(outputFile,JSON.stringify(output,null,2));
console.log(outputFile);
