import fs from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {performance} from 'node:perf_hooks';
import {resolveInvestigationSelector} from '/workspace/skills/tools/investigation-report/src/investigation-selector.ts';
const file='file:///workspace/skills/tools/decision-records/src/decision-stage-refresh-pending.ts';
const hook=registerHooks({load(url,context,next){const r=next(url,context);return url===file?{...r,source:String(r.source)+'\nexport { verifyPendingLocatorIdentity as auditVerifyPendingLocatorIdentity };\n'}:r;}});
const {auditVerifyPendingLocatorIdentity}=await import(file);hook.deregister();
const results={investigationBatchSelectors:[],decisionPendingLocator:[]};
for(const n of [20,200,2000]){
 let visits=0;const ids=Array.from({length:n},(_,i)=>'261001-probe-'+String(i).padStart(5,'0'));
 const entries=ids.map(id=>({get id(){visits++;return id;},name:id.slice(7)}));
 const t=performance.now();for(const id of ids){const r=resolveInvestigationSelector(entries,id);if(r.status!=='ok'||r.id!==id)throw new Error('selector result mismatch')}
 results.investigationBatchSelectors.push({entries:n,selectors:n,idVisits:visits,expectedTriangular:n*(n+1)/2,elapsedMs:performance.now()-t});
}
for(const [n,k] of [[1000,1],[1000,20],[1000,100],[10000,100]]){
 const raw={};const ids=[];for(let i=0;i<n;i++){const id='261001-probe-'+String(i).padStart(5,'0');ids.push(id);raw[id]={sourcePath:id+'.md'}}
 let gets=0;const entries=new Proxy(raw,{get(target,key,receiver){if(typeof key==='string'&&Object.hasOwn(target,key))gets++;return Reflect.get(target,key,receiver)}});
 const selected=new Set(ids.slice(-k));const t=performance.now();
 for(const id of selected){auditVerifyPendingLocatorIdentity({source:{sourcePath:raw[id].sourcePath,decisionId:id}},selected,{entries},{entries:raw})}
 results.decisionPendingLocator.push({indexEntries:n,selectedPayloads:k,materializedEntryValues:gets,expectedProduct:n*k,elapsedMs:performance.now()-t});
}
await fs.writeFile(new URL('./batch-selection-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
