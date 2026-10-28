# Terra 审计形成时方法

这些脚本是当次源码探针与隔离 fixture 的原始方法，按原内容保存于代码块。绝对路径反映采集环境；供方法审计，重跑需恢复对应版本、路径和运行依赖。文件内容保持原样，以下摘要不把它们当作持续维护测试。

## /tmp/dr-audit-1671249/candidate-probe.ts

SHA-256: `909f94a7386c28477dd13cec44e832d8b24a35402da0769511fa3fc7f1f5da52`

```typescript
import fs from 'node:fs/promises';
import {loadCandidateIdentityContext} from '/workspace/skills/tools/decision-records/src/decision-candidate-discovery.ts';
const base='/tmp/dr-audit-1671249/candidates'; await fs.mkdir(base,{recursive:true}); await fs.copyFile('/workspace/skills/docs/decisions/decision-index.json',base+'/decision-index.json');
for(const n of [20,100,200]) {const selectors=[];for(let i=0;i<n;i++){const id=`260101-a${String(i).padStart(4,'0')}`;selectors.push(id);await fs.writeFile(`${base}/${id}.md`,`---\nid: "${id}"\nstatus: candidate\n---\n`);}let count=0;const old=Array.prototype.some;Array.prototype.some=function(fn:any,thisArg:any){if(this.length===n && this[0]?.sourcePath?.startsWith('260101-a')){for(let i=0;i<this.length;i++){count++;if(fn.call(thisArg,this[i],i,this))return true;}return false;}return old.call(this,fn,thisArg);};try{let result=await loadCandidateIdentityContext(base,selectors);console.log(JSON.stringify({n,count,candidates:result.collection.candidates.length}));}finally{Array.prototype.some=old;}}
```

## /tmp/dr-audit-1671249/evolve-probe.ts

SHA-256: `5ba6a9e8c087c002ba44194b429e405cb23757f45b63c826a4d1fc2aa696fe13`

```typescript
import fs from 'node:fs/promises';
const root='/workspace/skills/tools/decision-records/src/'; const original=await fs.readFile(root+'decision-maintenance-context.ts','utf8');
const rewritten=original.replaceAll('from "./',`from "${root}`).concat('\nexport { addActiveMaintenancePredecessors };\n');
await fs.writeFile('/tmp/dr-audit-1671249/maintenance-probe-copy.ts',rewritten);
const {addActiveMaintenancePredecessors}=await import('/tmp/dr-audit-1671249/maintenance-probe-copy.ts');
for(const n of [20,100,200]){const ids=Array.from({length:n},(_,i)=>`260101-x${i}`);const records=ids.map(decisionId=>({decisionId,projection:{relations:[]}}));const groups=ids.map(source=>({source,relationOverride:{kind:'replace',relations:[]}}));const request:any={action:'evolve',successors:ids.map(decisionId=>({decisionId})),relationOverrideGroups:groups,relationOverride:{kind:'source'}};let recordComparisons=0,groupComparisons=0;const old=Array.prototype.find;Array.prototype.find=function(fn:any,thisArg:any){if(this===records||this===groups){for(let i=0;i<this.length;i++){if(this===records)recordComparisons++;else groupComparisons++;if(fn.call(thisArg,this[i],i,this))return this[i]}return undefined}return old.call(this,fn,thisArg)};try{const selected=new Set(ids);addActiveMaintenancePredecessors(request,records,selected,{availableIds:new Set(ids),baseline:{entries:{}}});console.log(JSON.stringify({n,recordComparisons,groupComparisons,selected:selected.size}));}finally{Array.prototype.find=old}}
```

## /tmp/dr-audit-1671249/graph-probe.ts

SHA-256: `358dcfeef682477f7171b880fa812514765e137b462bb730f4982792fa13ea71`

```typescript
import {relationStrategyFor} from '/workspace/skills/tools/decision-records/src/decision-relation-transaction-strategy.ts';
for(const n of [20,100,200]) {const records:any[]=[];for(let i=0;i<n;i++){const target=`p${i}`;records.push({decisionId:`s${i}`,projection:{relations:[{type:'重划',target}]}})}const successors:any[]=[];for(let j=0;j<n;j++){const id=`z${j}`;const rel=[{type:'重划',target:'zzp'}];records.push({decisionId:id,projection:{relations:rel}});successors.push({record:{decisionId:id},finalRelations:rel})}let checks=0;const old=Set.prototype.has;Set.prototype.has=function(x:any){if(new Error().stack?.includes('hasSelectedSuccessor')) checks++;return old.call(this,x);};try{const errors=relationStrategyFor(successors).closureErrors(successors,records);console.log(JSON.stringify({unrelatedComponents:n,selected:n,checks,errors:errors.length}));}finally{Set.prototype.has=old;}}
```

## /tmp/dr-audit-1671249/locator-probe.ts

SHA-256: `9711af353730d41c82f673b9e0e6adb7ccb28440dbc6305e9c3f76f2a00d3f29`

```typescript
import {selectedPendingPaths} from '/workspace/skills/tools/decision-records/src/decision-stage-refresh-locators.ts';
for(const n of [20,100,200]) {const selectors=Array.from({length:n},(_,i)=>`select-${i}`); const members=Array.from({length:n},(_,i)=>({path:`docs/decisions/260101-other-${i}.md`,kind:'regular'})); const opts:any={selectors,scope:'domain',opened:{decisionScope:'docs/decisions'}};const baseline:any={indexPath:'docs/decisions/decision-index.json',head:null,workspace:{entries:{}}};const locator:any={snapshot:{members,files:[]},index:null,consumeIndex:false};let checks=0;const old=Array.prototype.some;Array.prototype.some=function(fn:any,thisArg:any){if(this===selectors){for(let i=0;i<this.length;i++){checks++;if(fn.call(thisArg,this[i],i,this))return true;}return false}return old.call(this,fn,thisArg)};try{const result=selectedPendingPaths(opts,baseline,locator);console.log(JSON.stringify({n,checks,paths:result.contentPaths.length}));}finally{Array.prototype.some=old;}}
```

## /tmp/dr-audit-1671249/new-probe.ts

SHA-256: `329ea709860d8b12994113e99dc265d954d5823bc16ad4d2fe4e5a0dc2881a02`

```typescript
import {resolveCandidateRelationSelectors} from '/workspace/skills/tools/decision-records/src/decision-candidate-relations.ts';
for(const n of [20,100,200]){const records=Array.from({length:n},(_,i)=>({decisionId:`260101-x${i}`,sourcePath:`260101-x${i}.md`}));const relations=records.map((_,i)=>({type:'修订',target:`x${i}`}));let count=0;const old=Array.prototype.filter;Array.prototype.filter=function(fn:any,thisArg:any){if(this===records){const result=[];for(let i=0;i<this.length;i++){count++;if(fn.call(thisArg,this[i],i,this))result.push(this[i])}return result}return old.call(this,fn,thisArg)};try{let res=resolveCandidateRelationSelectors({records} as any,{relations} as any);console.log(JSON.stringify({n,count,status:res.status}));}finally{Array.prototype.filter=old}}
```

## /tmp/dr-audit-1671249/probe.ts

SHA-256: `a23da54a56c122061de932908a1e9fa4336026c72c3cf45c8571b2b7375fcc3e`

```typescript
import {resolveDecisionLifecycleRequest} from '/workspace/skills/tools/decision-records/src/cli-lifecycle-selection.ts';
for (const n of [20,200,1000]) {let comparisons=0;const entries:any={};const ids=[];for(let i=0;i<n;i++){const id=`260101-x${i}`;ids.push(id); entries[id]={};}const original=Array.prototype.includes;Array.prototype.includes=function(x:any,...rest:any[]){if(typeof x==='string'&&x.startsWith('260101-x')){for(const y of this){comparisons++;if(y===x)return true;}return false;}return original.call(this,x,...rest as [number]);};try{let r=resolveDecisionLifecycleRequest({records:[],publishedBaseline:{entries}} as any,{action:'archive',decisionIds:ids} as any);console.log(JSON.stringify({n,comparisons,status:r.status}));}finally{Array.prototype.includes=original;}}
```

## /tmp/dr-audit-1671249/shared/canonical-probe.ts

SHA-256: `d06bfdeb433a558fed04c53de3736caaba0fc0f47d63c4ef8c6123b03b7403be`

```typescript
import {canonicalizeStateIndex} from '/workspace/skills/tools/index-runtime/src/canonicalization.ts';
import {serializeStateIndex} from '/workspace/skills/tools/index-runtime/src/snapshot-parser.ts';
for(const n of [20,100,200]) {const entries:any={},rev:any={};for(let i=0;i<n;i++){entries['id'+i]={marker:'m'+i,text:'x'.repeat(128)};rev['id'+i]='r'}const def:any={fieldOrder:'definition'};const raw:any={schemaVersion:4,namespace:'test',definitionVersion:1,metadata:{},sourceRevision:{entries:rev,metadata:'m'},entries};let traversals=0;const orig=Object.entries;Object.entries=function(v:any){if(v?.marker)traversals++;return orig(v)};try {const built=canonicalizeStateIndex(raw,def);const first=traversals; const text=serializeStateIndex(built,def);console.log(JSON.stringify({n,build:first,serialization:traversals-first,bytes:Buffer.byteLength(text)}))}finally{Object.entries=orig}}
```

## /tmp/ir-audit-1793158083/candidate-probe.mjs

SHA-256: `e75eb6c592053cfc1d37daf8cc729f7951c1f8c7059f67b8859994cf500a5cde`

```javascript
import fs from 'node:fs'; import path from 'node:path';
const src='/workspace/skills/tools/investigation-report/src', dir='/tmp/ir-audit-1793158083'; let t=fs.readFileSync(path.join(src,'candidate-read-context.ts'),'utf8');
t=t.replace(/(from\s+["'])(\.[^"']+)(["'])/g,(_,a,b,c)=>a+path.resolve(src,b)+c);
t=t.replace('function prepareCandidateDocuments(', 'function originalPrepareCandidateDocuments(');
t+='\nfunction prepareCandidateDocuments(layout, ids) { return globalThis.__fixture; }\n';
t=t.replace('import { prepareCandidateResources } from "'+src+'/candidate-read-resources.ts";', 'async function prepareCandidateResources() { return {resources: undefined, ownerWarnings: []}; }');
t=t.replace('import { loadInvestigationQueryIndex } from "'+src+'/investigation-state-index.ts";', 'async function loadInvestigationQueryIndex() { return {status:"ok", value:{entries:globalThis.__entries}}; }');
fs.writeFileSync(path.join(dir,'candidate-probe.ts'),t); const {prepareCandidateReadContext}=await import('./candidate-probe.ts');
for(const [n,r] of [[100,10],[1000,10],[1000,100]]) { let comparisons=0;const ids=Array.from({length:n},(_,i)=>`261028-r${String(i).padStart(5,'0')}`);const owners=ids.slice(-r);const reportIds=new Proxy(ids,{get(t,k,v){if(/^\d+$/.test(String(k))) comparisons++;return Reflect.get(t,k,v)}});globalThis.__entries=Object.fromEntries(ids.map(id=>[id,{resourceIds:[]}])) ;globalThis.__fixture={sources:new Map(), parsed:new Map(),references:new Map([['candidate', new Set(owners.map(id=>`${id}/file`))]])}; const result=await prepareCandidateReadContext('/tmp',{reportIds},['candidate']);console.log(JSON.stringify({n,r,comparisons,ownerReferences:result.references.size}));}
```

## /tmp/ir-audit-1793158083/dr-trace-probe.mjs

SHA-256: `9611bc6bd1b8080e0cffff349752db490410c1d40ce93890726c6be5cbd8a8bd`

```javascript
import {buildRelationGraph} from '/workspace/skills/tools/shared/src/graph/relations.ts';import {traceDecisionRelations} from '/workspace/skills/tools/decision-records/src/relation-graph.ts';for(const n of [10,100]){let reads=0;const ids=Array.from({length:n},(_,i)=>`id${i}`),edges=ids.slice(0,-1).map((id,i)=>({source:id,target:ids[i+1],type:'补充'}));const g=buildRelationGraph(ids,edges);const map={get(id){reads++;return g.edgesBySource.get(id)}};const out=traceDecisionRelations(()=>({...g,edgesBySource:map}),ids[0],{direction:'predecessors',maxDepth:null,maxRecords:n+1});console.log(JSON.stringify({n,edges:edges.length,sourceAdjacencyReads:reads,traceCount:out.traceIds.length,complete:out.coverage.complete}));}
```

## /tmp/ir-audit-1793158083/metadata-probe.mjs

SHA-256: `f27356567a78beb36f1246feadf68bb3d35c0c1058801865a8ba72433bfa67fe`

```javascript
import {createTextSearchMatcher,matchTextSegments} from '/workspace/skills/tools/shared/src/file-text-search/segment-matcher.ts';const original=String.prototype.indexOf;let n=0;String.prototype.indexOf=function(x,...a){if(x==='a')n++;return original.call(this,x,...a)};try{for(const size of [100,1000]){n=0;const matches=matchTextSegments(createTextSearchMatcher({mode:'phrase',text:'a'}),[{identifier:'title',text:'a '.repeat(size)}]);console.log(JSON.stringify({occurrences:size,indexOfCalls:n,identifiers:matches.map(x=>x.identifier),ranges:matches[0]?.ranges.length}));}}finally{String.prototype.indexOf=original}
```

## /tmp/ir-audit-1793158083/plan-probe.mjs

SHA-256: `4747eca86f308bd486c1bd1731eff81322729ececb73f1865e7eaf234cb575d1`

```javascript
import fs from 'node:fs';import path from 'node:path';const src='/workspace/skills/tools/investigation-report/src', dir='/tmp/ir-audit-1793158083';let t=fs.readFileSync(path.join(src,'relation-transaction-plan.ts'),'utf8');t=t.replace(/(from\s+["'])(\.[^"']+)(["'])/g,(_,a,b,c)=>a+path.resolve(src,b)+c);const pattern=new RegExp('import \\{[\\s\\S]*?\\} from "'+src+'/transaction-files\\.ts";');t=t.replace(pattern,'async function investigationFileWrite(root,p,b,n){return {path:p,before:b,next:n}}; async function investigationMembers(){return []};');fs.writeFileSync(path.join(dir,'plan-probe.ts'),t);const {prepareRelationWrites}=await import('./plan-probe.ts');for(const [c,k] of [[100,10],[1000,10],[1000,100]]){const ids=Array.from({length:c},(_,i)=>`id-${i}`),selected=ids.slice(-k);let comparisons=0;const changedSources=new Proxy(selected,{get(t,k,r){if(/^\d+$/.test(String(k))) comparisons++;return Reflect.get(t,k,r)}});const sources=ids.map(id=>({id,sourcePath:id,text:'x'}));const plan=await prepareRelationWrites({root:'/tmp',indexPath:'/tmp/index',write:async()=>{}},{collection:{sources},candidateSources:sources,changedSources,originalIndexText:'',nextIndexText:''});console.log(JSON.stringify({c,k,comparisons,writes:plan.writes.length,guards:plan.guards.length}));}
```

## /tmp/ir-audit-1793158083/probe.mjs

SHA-256: `3c8da6eb4e3e3f911f72f5c8581071f4d75dc5f72eebdb27b19b3f1617de7bca`

```javascript
import fs from 'node:fs'; import path from 'node:path';
const src='/workspace/skills/tools/investigation-report/src'; const dir='/tmp/ir-audit-1793158083';
for (const [file,names] of [['staging-pending.ts',['selectedPendingReportPaths','selectedCanonicalPendingPaths','requiresPendingLocator']],['staging-domain-membership.ts',['validateSelectedPathOwnership']]]) {
 let t=fs.readFileSync(path.join(src,file),'utf8'); t=t.replace(/(from\s+["'])(\.[^"']+)(["'])/g,(_,a,b,c)=>a+path.resolve(src,b)+c); t+='\nexport { '+names.join(', ')+' };\n'; fs.writeFileSync(path.join(dir,file),t);
}
const p=await import('./staging-pending.ts'); const m=await import('./staging-domain-membership.ts');
for (const [n,k] of [[100,10],[1000,10],[1000,100]]) {
 let comparisons=0; const ids=Array.from({length:n},(_,i)=>`261028-r${String(i).padStart(5,'0')}`); const selectors=ids.slice(-k); const prox=new Proxy(selectors,{get(t,key,r){if (/^\d+$/.test(String(key))) comparisons++; return Reflect.get(t,key,r)}}); const entries=Object.fromEntries(ids.map(id=>[id,{sourcePath:id+'.md'}]));
 p.selectedPendingReportPaths({investigationsScope:'docs/investigations'},{entries},prox,[],[]); const pending=comparisons; comparisons=0;
 const metadata={members:ids.map(id=>({path:`docs/investigations/${id}.md`}))}; p.selectedCanonicalPendingPaths({investigationsScope:'docs/investigations'},metadata,{input:{reportIds:prox}}); const canonical=comparisons; comparisons=0;
 let enumerated=0; const entriesProxy=new Proxy(entries,{ownKeys(t){const keys=Reflect.ownKeys(t); enumerated+=keys.length; return keys}}); p.requiresPendingLocator(prox,[{entries:entriesProxy}],[]); const locatorSelectorAccess=comparisons;
 comparisons=0; m.validateSelectedPathOwnership({scope:'domain',selectedIds:prox,workspaceIndex:{entries},pendingIndex:null,pendingReportPaths:new Map(),investigationsScope:'docs/investigations'},new Set()); const membership=comparisons;
 console.log(JSON.stringify({n,k,pendingComparisons:pending,canonicalComparisons:canonical,locatorSelectorAccess,locatorEnumeratedKeys:enumerated,membershipComparisons:membership}));
}
```

## /tmp/ir-audit-1793158083/publish-probe.mjs

SHA-256: `c3b008eea3ed9ab0e840d959e20ad5f035602460f0d52fa8704f808940c406f8`

```javascript
import fs from 'node:fs';import path from 'node:path';const src='/workspace/skills/tools/investigation-report/src', dir='/tmp/ir-audit-1793158083';let t=fs.readFileSync(path.join(src,'publish-preparation.ts'),'utf8');t=t.replace(/(from\s+["'])(\.[^"']+)(["'])/g,(_,a,b,c)=>a+path.resolve(src,b)+c);t+='\nexport { selectedCandidateErrors };\n';fs.writeFileSync(path.join(dir,'publish-probe.ts'),t);const {selectedCandidateErrors}=await import('./publish-probe.ts');for(const [c,k] of [[100,10],[1000,10],[1000,100]]){let comparisons=0;const ids=Array.from({length:c},(_,i)=>`id-${i}`);const candidates=new Proxy(ids,{get(t,k,r){if(/^\d+$/.test(String(k)))comparisons++;return Reflect.get(t,k,r)}});const errors=selectedCandidateErrors({candidateIds:candidates},ids.slice(-k));console.log(JSON.stringify({c,k,comparisons,errors:errors.length}));}
```

## /tmp/ir-audit-1793158083/relation-probe.mjs

SHA-256: `7366822b0f112a1a7bc0c54de081b08cfb955ce2245a2dc1adb33d3fce1627a9`

```javascript
import fs from 'node:fs';import path from 'node:path';const src='/workspace/skills/tools/investigation-report/src', dir='/tmp/ir-audit-1793158083';let t=fs.readFileSync(path.join(src,'relation-transaction-execution.ts'),'utf8');t=t.replace(/(from\s+["'])(\.[^"']+)(["'])/g,(_,a,b,c)=>a+path.resolve(src,b)+c);
for(const [statement,stub] of [
 [`import { runRecordTransaction } from "/workspace/skills/tools/record-operations/src/transaction.ts";`,`async function runRecordTransaction(o){ await o.verify(globalThis.__relation); await o.verifyRecovered(globalThis.__relation); return {status:'error',changed:false,value:null,errors:[],cleanupErrors:[],outcome:'no-change',committed:false}; }`],
 [`import { verifyInvestigationMembers } from "${src}/transaction-files.ts";`,`async function verifyInvestigationMembers(root,members,paths){globalThis.__paths.push(paths.length);}`],
 [`import { parseStateIndex } from "/workspace/skills/tools/index-runtime/src/index.ts";`,`function parseStateIndex(){return {status:'ok',value:{}}}`],
 [`import { createInvestigationStateIndexDefinition } from "/workspace/skills/tools/investigation-report/src/investigation-state-index.ts";`,`function createInvestigationStateIndexDefinition(){return {}}`],
 [`import { readPublishedInvestigationDependencies } from "${src}/published-preparation.ts";`,`async function readPublishedInvestigationDependencies(){}`],
]) {if(!t.includes(statement)) throw new Error(statement);t=t.replace(statement,stub)}
fs.writeFileSync(path.join(dir,'relation-probe.ts'),t);const {applyRelationReplacements}=await import('./relation-probe.ts');for(const [c,k] of [[100,10],[1000,10],[1000,100]]){const ids=Array.from({length:c},(_,i)=>`id-${i}`),selected=ids.slice(-k);let accesses=0;const changedSources=new Proxy(selected,{get(t,k,r){if(/^\d+$/.test(String(k)))accesses++;return Reflect.get(t,k,r)}});globalThis.__paths=[];globalThis.__relation={members:[],context:{candidateSources:ids.map(id=>({id,sourcePath:id})),changedSources,collection:{sources:[]},nextIndexText:''}};try{await applyRelationReplacements({root:'/tmp',indexPath:'/tmp/index'});}catch(e){if(!String(e).includes('no-change'))throw e}console.log(JSON.stringify({c,k,selectorArrayAccessesTwoCallbacks:accesses,perCallback:accesses/2,paths:globalThis.__paths}));}
```

## /tmp/ir-audit-1793158083/resource-probe.mjs

SHA-256: `e5d1ad7336df243aa19ab81dc68141a343566b0db0ff3c2b913c11ed28c32ce5`

```javascript
import fs from 'node:fs'; import path from 'node:path';const src='/workspace/skills/tools/investigation-report/src', dir='/tmp/ir-audit-1793158083';let t=fs.readFileSync(path.join(src,'candidate-read-resources.ts'),'utf8');t=t.replace(/(from\s+["'])(\.[^"']+)(["'])/g,(_,a,b,c)=>a+path.resolve(src,b)+c);
for(const [s,v] of [[`import { prepareInvestigationResourceRoot } from "${src}/resource-root.ts";`,`async function prepareInvestigationResourceRoot(){return globalThis.__resources}`],[`import { validateReferencedInvestigationResources,\n  type InvestigationResourceReferencesByReport\n} from "${src}/resources.ts";`,``]]) {if(t.includes(s))t=t.replace(s,v)}
// Resource validator is not invoked: all selected visible files are already referenced.
fs.writeFileSync(path.join(dir,'resource-probe.ts'),t);const {prepareCandidateResources}=await import('./resource-probe.ts');for(const [f,k] of [[100,10],[1000,10],[1000,100]]){let yielded=0;const selected=Array.from({length:k},(_,i)=>`261028-owner${i}`);const files=Array.from({length:f},(_,i)=>`${selected[i%k]}/file${i}`);const membership={*[Symbol.iterator](){for(const x of files){yielded++;yield x}}};globalThis.__resources={status:'ready',membership:{mode:'version-control',files:membership}};const references=new Map(selected.map(id=>[id,new Set(files.filter(p=>p.startsWith(id+'/')))]));const result=await prepareCandidateResources('/tmp',true,references,selected);console.log(JSON.stringify({f,k,iteratorYields:yielded,warnings:result.ownerWarnings.length}));}
```

## /tmp/ir-audit-1793158083/shared-search-probe.mjs

SHA-256: `d8aec6f19a30ef372f0679a325a10d00517fff1ec3d8dabed2c010a4b20f7ca9`

```javascript
import fs from 'node:fs/promises';import path from 'node:path';import {searchRecordText} from '/workspace/skills/tools/shared/src/file-text-search/record-search.ts';const root='/tmp/ir-audit-1793158083/search-fixture';await fs.mkdir(root,{recursive:true});for(let i=0;i<10;i++)await fs.writeFile(path.join(root,`${i}.md`),'a '.repeat(1000));const origIndex=String.prototype.indexOf;let finds=0;String.prototype.indexOf=function(needle,...rest){if(needle==='a') finds++;return origIndex.call(this,needle,...rest)};const originals={lstat:fs.lstat,realpath:fs.realpath};let counts={lstat:0,realpath:0};for(const n of Object.keys(originals))fs[n]=async (...args)=>{counts[n]++;return await originals[n](...args)};try {const result=await searchRecordText({root,selection:{kind:'files',sourcePaths:Array.from({length:10},(_,i)=>`${i}.md`)},query:{mode:'phrase',text:'a'},preview:{contextLines:0,maxFiles:1,maxMatchesPerFile:3,maxPreviewCharacters:100}});console.log(JSON.stringify({selected:result.selectedFiles,scanned:result.scannedFiles,matched:result.matched,returned:result.hits.length,finds,counts,truncation:result.truncation,firstPreviewRanges:result.hits[0]?.previews[0]?.ranges.length}));}finally{String.prototype.indexOf=origIndex;for(const n of Object.keys(originals))fs[n]=originals[n]}
```

## /tmp/ir-audit-1793158083/trace-probe.mjs

SHA-256: `a1cb71edb0b184e8e325552a1a5a23f0b993c70e720fa5ab46f6a9af5ad7dd91`

```javascript
import {buildRelationGraph} from '/workspace/skills/tools/shared/src/graph/relations.ts';import {traceInvestigationRelations} from '/workspace/skills/tools/investigation-report/src/relation-validation.ts';for(const n of [10,100]){let reads=0;const ids=Array.from({length:n},(_,i)=>`id${i}`),edges=ids.slice(0,-1).map((id,i)=>({source:id,target:ids[i+1],type:'补充'}));const g=buildRelationGraph(ids,edges);const map={get(id){reads++;return g.edgesBySource.get(id)}};const out=traceInvestigationRelations({graph:()=>({...g,edgesBySource:map})},ids[0],{direction:'predecessors',maxDepth:null,maxRecords:n+1});console.log(JSON.stringify({n,edges:edges.length,sourceAdjacencyReads:reads,traceCount:out.traceIds.length,complete:out.coverage.complete}));}
```

## /tmp/terra-shared-audit-696b/blob-write-probe.ts

SHA-256: `c6fd8f12d1cb6b8594999d68f99bff615f34eac7856948ccf8a5099e2c813bc3`

```typescript
import {createPendingEntries} from '/workspace/skills/tools/shared/src/version-control/git-pending.ts';
const root=process.argv[2]!; const n=Number(process.argv[3]);const type=process.argv[4]!;
const files=Array.from({length:n},(_,i)=>({path:`scope/${String(i).padStart(4,'0')}.txt`,kind:'regular' as const,data:Buffer.from(type==='same'?'same\n':`contents ${i}\n`)}));
const records=await createPendingEntries({rootDirectory:root} as never,files,[],[]);
console.log(JSON.stringify({n,type,count:records.length,uniqueObjects:new Set(records.map(x=>x.objectId)).size}));
```

## /tmp/terra-shared-audit-696b/cycle.ts

SHA-256: `9fe68d92ea8b01ad8fe56857e23ae8dfdddad6217b3a5676d4caf783f29cac14`

```typescript
import {buildRelationGraph, relationGraphStructuralIssues} from '/workspace/skills/tools/shared/src/graph/relations.ts';
for(const n of [20,200,1000]) {
  const ids=Array.from({length:n},(_,i)=>String(i).padStart(5,'0'));
  const edges=ids.slice(1).flatMap((id,i)=>[{source:ids[i]!,target:id,type:'x'},...(i>=1?[{source:id,target:ids[i]!,type:'x'}]:[])]);
  const graph=buildRelationGraph(ids,edges); let calls=0, comparisons=0;
  const orig=Array.prototype.indexOf;
  Array.prototype.indexOf=function(...args) { const out=orig.apply(this,args as [unknown,number?]); if(typeof args[0]==='string' && /^\d{5}$/.test(args[0])) { calls++; comparisons+=out<0?this.length:out+1; } return out; };
  try {const result=relationGraphStructuralIssues(graph); console.log(JSON.stringify({n,edges:edges.length,calls,comparisons,cycles:result.filter(x=>x.kind==='cycle').length,totalCycleMembers:result.filter(x=>x.kind==='cycle').reduce((a,x)=>a+(x.kind==='cycle'?x.cycle.length:0),0)}));} finally {Array.prototype.indexOf=orig;}
}
```

## /tmp/terra-shared-audit-696b/pending-records-probe.ts

SHA-256: `21501940ccc19e781f57539634c3980874cbed90172e2c6d950d819ae090529a`

```typescript
import {pendingIndexRecords} from './git-pending-probe-copy.ts';
for (const n of [10,100,1000]) {
 const entries = Array.from({length:n},(_,i)=>({path:`scope/${String(i).padStart(6,'0')}.md`,mode:'100644',objectId:'a'.repeat(40),stage:0}));
 const next=entries.map((x,i)=>i===n-1? {...x,objectId:'b'.repeat(40)}:x);
 const unchanged=pendingIndexRecords(entries,entries); const changed=pendingIndexRecords(entries,next);
 console.log(JSON.stringify({n,changedEntries:1,unchangedIsNull:unchanged===null,records:changed?.split('\0').length!-1,bytes:Buffer.byteLength(changed!)}));
}
```
