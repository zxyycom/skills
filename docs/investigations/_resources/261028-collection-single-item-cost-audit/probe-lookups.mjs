import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {historySourcePaths} from '/workspace/skills/tools/decision-records/src/decision-history-sources.ts';
import {loadDecisionMaintenanceContext} from '/workspace/skills/tools/decision-records/src/decision-maintenance-context.ts';
const results={syntheticHistory:[],realMaintenanceReadOnly:[]};
for(const n of [20,200,2000]){
 let visits=0;const entries={};const records=[];const wanted=new Set();
 for(let i=0;i<n;i++){const id='261001-synthetic-'+String(i).padStart(5,'0');wanted.add(id);entries[id]={sourcePath:id+'.md'};records.push({get decisionId(){visits++;return id;}})}
 const t=performance.now();const got=historySourcePaths({records},{entries},wanted,'docs/decisions/');
 if(got.size!==n)throw new Error('wrong result size');
 results.syntheticHistory.push({records:n,wanted:n,allWantedInPublishedIndex:true,resultPaths:got.size,decisionIdVisits:visits,elapsedMs:performance.now()-t,expectedTriangular:n*(n+1)/2});
}
const idx=JSON.parse(await fs.readFile('/workspace/skills/docs/decisions/decision-index.json','utf8'));
const ids=Object.keys(idx.entries);
const original=Array.prototype.some;
for(const k of [20,100,200]){
 if(ids.length<k)continue;
 let calls=0,visits=0;
 Array.prototype.some=function(callback,thisArg){
  if(!/record\.decisionId\s*===\s*id/.test(String(callback)))return Reflect.apply(original,this,[callback,thisArg]);
  calls++;return Reflect.apply(original,this,[function(...args){visits++;return Reflect.apply(callback,thisArg,args)}]);
 };
 let context;const start=performance.now();
 try{context=await loadDecisionMaintenanceContext({workspaceRoot:'/workspace/skills',decisionsDir:'docs/decisions'},{action:'archive',decisionIds:ids.slice(0,k)});}finally{Array.prototype.some=original;}
 results.realMaintenanceReadOnly.push({publishedRecords:ids.length,selected:k,loaded:context.records.length,dedupSomeCalls:calls,dedupSomeVisits:visits,expectedTriangular:k*(k-1)/2,elapsedMs:performance.now()-start});
}
await fs.writeFile(new URL('./lookup-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
