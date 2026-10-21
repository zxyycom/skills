import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import { syncBuiltinESMExports, registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
if (!process.argv[2] || !process.argv[3]) throw Error('Usage: node measure.mjs <repo-root> <new-output.json>');
const repo=path.resolve(process.argv[2]);
const out=path.resolve(process.argv[3]);
const allocatedFixtures=new Set();
const experiment = process.env.IR_AUDIT_EXPERIMENT === 'local-reuse';

Error.stackTraceLimit = 28;
const probes = {
  'markdown.ts': [['const lines = normalizeMarkdownNewlines(markdown).split("\\n");', 'globalThis.__irAudit("entry", "parseReport", Buffer.byteLength(markdown)); ']],
  'relation-validation.ts': [['const ids = [...states.keys()].sort(compareText);', 'globalThis.__irAudit("entry", "validateGraph", states.size); ']],
  'resource-root.ts': [['const resourcesRoot = path.join(', 'globalThis.__irAudit("entry", "prepareResourceRoot"); ']],
  'query-search-selection.ts': [['if (query.relatedTo === undefined)\n    return filterTypeOnlyRelations', 'globalThis.__irAudit("entry", "filterRelations"); if (query.relatedTo === undefined)\n    return filterTypeOnlyRelations']],
  'candidate-document.ts': [['const loaded = await loadInvestigationIndex({ investigationsDirectory });', 'globalThis.__irAudit("entry", "candidateFormalIdentity", layout.formalSources.length); ']],
  'investigation-layout.ts': [['const scan: InvestigationLayoutScan = {', 'globalThis.__irAudit("entry", "inspectLayout"); ']],
  'investigation-state-index.ts': [['const current = await loadCurrentStateIndex({', 'globalThis.__irAudit("entry", "loadCurrentInvestigationIndex"); ']]
};
globalThis.__irAudit = (...args) => count(...args);
registerHooks({load(url,context,nextLoad) {
  const result=nextLoad(url,context);
  if(!url.startsWith('file://'+repo+'/tools/investigation-report/src/'))return result;
  const file=url.slice(url.lastIndexOf('/')+1);
  if(!probes[file] && !(experiment && file==='query-index.ts'))return result;
  let source=String(result.source);
  for(const [marker,insertion]of probes[file]??[]) {
    if(!source.includes(marker)) throw Error('probe marker missing '+file);
    source=source.replace(marker,insertion.includes('if (query.relatedTo')?insertion:insertion+marker);
  }
  if(experiment && file==='investigation-state-index.ts') {
    const before='return parseStateIndex({\n    definition,\n    expectation: expectationOf(definition),\n    sourcePath: indexPath,\n    text: serializeStateIndex(current.value, definition)\n  });';
    if(!source.includes(before))throw Error('experiment current marker');
    source=source.replace(before,'return current;');
  }
  if(experiment && file==='candidate-document.ts') {
    const before='const loaded = await loadInvestigationIndex({ investigationsDirectory });';
    source=source.replace(before,'if (layout.formalSources.length > 0) return {layout, ids: layout.reportIds}; '+before);
  }
  if(experiment && file==='query-index.ts') {
    const before='const related = relatedInvestigationIds(entries, validated);\n  if (related.isErr()) return err({ diagnostics: [], errors: related.error });\n  const filterRelations = filterRelationsByEntry(entries, validated);';
    const after='const filterRelations = filterRelationsByEntry(entries, validated);';
    if(!source.includes(before))throw Error('experiment list marker');
    source=source.replace(before,after).replace('if (related.value !== null && related.value.size === 0)','const related = ok(filterRelations.value === null ? null : new Set(filterRelations.value.keys())); if (related.value !== null && related.value.size === 0)');
  }
  return {...result,source};
}});
const {reportMarkdown}=await import(`${repo}/tools/investigation-report/tests/fixture-support.ts`);
const {synchronizeFullCollection}=await import(`${repo}/tools/investigation-report/src/validation-sync-flow.ts`);
const {validateFullCollection}=await import(`${repo}/tools/investigation-report/src/validation-check-flow.ts`);
const {searchInvestigationReports}=await import(`${repo}/tools/investigation-report/src/query-search.ts`);
const {publishInvestigationCandidates}=await import(`${repo}/tools/investigation-report/src/publish.ts`);
const {prepareInvestigationPublish}=await import(`${repo}/tools/investigation-report/src/publish-preparation.ts`);
const {setInvestigationRelations}=await import(`${repo}/tools/investigation-report/src/relation-transaction.ts`);
const {queryInvestigationIndex}=await import(`${repo}/tools/investigation-report/src/query.ts`);
let metrics=null,fixture='';
function stack(){return new Error().stack.split('\n').filter(x=>x.includes('/tools/')&&!x.includes('node_modules')).slice(0,5).map(x=>x.replaceAll(repo+'/','').replace(/:\d+:\d+/g,'').trim()).join(' <- ');}
function pathKind(relative){if(relative.endsWith('investigation-index.json'))return 'index';if(relative.includes('/_candidate.'))return 'candidate-source';if(relative.includes('/_resources/'))return 'resource-member';if(relative.endsWith('/_resources'))return 'resource-root';if(relative.endsWith('.md'))return 'formal-source';return 'collection-root';}
function count(kind,detail='',amount=0){if(!metrics)return;const key=kind+' | '+detail+' | '+stack();const v=metrics[key]??={calls:0,amount:0};v.calls++;v.amount+=amount;}
for(const name of ['readFile','readdir','lstat','realpath','open']){const original=fs[name];fs[name]=async function(...args){const target=String(args[0]);const tracked=metrics&&target.startsWith(fixture+'/');if(tracked)count(name,pathKind(target.slice(fixture.length+1)));return await original.apply(this,args);};}
const jp=JSON.parse;JSON.parse=function(...args){count('JSON.parse','',typeof args[0]==='string'?args[0].length:0);return jp.apply(this,args);};
const dp=Date.parse;Date.parse=function(...args){count('Date.parse');return dp.apply(this,args);};
for(const name of ['spawn','execFile']){const original=cp[name];cp[name]=function(...args){if(args[0]==='git')count('git',args[1].map(x=>typeof x==='string'?x.replaceAll(fixture,'<fixture>'):x).join(' '));return original.apply(this,args);};}
syncBuiltinESMExports();
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
function hashResult(result){return createHash('sha256').update(JSON.stringify(stable(result)).replaceAll(fixture,'<fixture>')).digest('hex');}
async function observe(name,fn){metrics={};const result=await fn();const groups=metrics;metrics=null;return {name,result:{semanticHash:name.endsWith('prepare-only')?null:hashResult(result),status:result.status??(result.errors?.length===0?'ok':'error'),errors:result.errors??[],warnings:result.warnings?.length??0,total:result.total,returned:result.entries?.length,changed:result.changed},groups};}
async function makeFixture(N,C,resources=true,git=true){const root=await fs.mkdtemp(path.join(os.tmpdir(),'ir-domain-audit-fixture-'));allocatedFixtures.add(root);const dir=path.join(root,'docs/investigations');await fs.mkdir(dir,{recursive:true});if(git)cp.execFileSync('git',['init','-q',root]);const ids=Array.from({length:N},(_,i)=>`260828-report-${i}`);for(const [i,id]of ids.entries()){const own=resources?[`${id}/asset.txt`]:[];await fs.writeFile(path.join(dir,`${id}.md`),reportMarkdown({id,relations:i?[{type:'复查',target:ids[0],summary:'前序'}]:[],resources:own.length?own:undefined}));for(const resource of own){const p=path.join(dir,'_resources',resource);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,'resource\n');}}const synced=await synchronizeFullCollection(dir,'write',undefined);if(synced.errors.length)throw Error(synced.errors.join('\n'));const candidates=Array.from({length:C},(_,i)=>`260828-candidate-${i}`);for(const id of candidates){const own=resources?[`${id}/asset.txt`,`${ids[0]}/asset.txt`]:[];await fs.writeFile(path.join(dir,`_candidate.${id}`),reportMarkdown({id,resources:own.length?own:undefined}));if(resources){const p=path.join(dir,'_resources',id,'asset.txt');await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,'candidate resource\n');}}return{root,dir,ids,candidates};}
const rows=[];
try {
for(const N of [20,200]){const f=await makeFixture(N,3,true,true);fixture=f.root;rows.push(await observe(`N${N}-check`,()=>validateFullCollection(f.dir)));rows.push(await observe(`N${N}-list-related`,()=>queryInvestigationIndex({workspaceRoot:f.root,relatedTo:f.ids[0],direction:'successors',limit:1000})));rows.push(await observe(`N${N}-content-current`,()=>searchInvestigationReports({workspaceRoot:f.root,query:'已形成结果',limit:1000})));rows.push(await observe(`N${N}-publish-preflight`,()=>publishInvestigationCandidates({workspaceRoot:f.root,ids:f.candidates,preflight:true})));rows.push(await observe(`N${N}-prepare-only`,()=>prepareInvestigationPublish(f.dir,f.candidates)));rows.push(await observe(`N${N}-relations-preflight-K1`,()=>setInvestigationRelations({workspaceRoot:f.root,replacements:[{source:f.ids[1],relations:[{type:'补充',target:f.ids[0]}]}],preflight:true})));rows.push(await observe(`N${N}-sync-selected-preflight`,()=>synchronizeFullCollection(f.dir,'preview',[f.ids[1]])));{const p=path.join(f.dir,`${f.ids[1]}.md`);await fs.writeFile(p,(await fs.readFile(p,'utf8')).replace('已形成结果，','已形成结果，当前追加，'));}rows.push(await observe(`N${N}-content-stale`,()=>searchInvestigationReports({workspaceRoot:f.root,query:'已形成结果',limit:1000})));await fs.rm(path.join(f.dir,'investigation-index.json'));rows.push(await observe(`N${N}-content-missing`,()=>searchInvestigationReports({workspaceRoot:f.root,query:'已形成结果',limit:1000})));await fs.rm(f.root,{recursive:true});}
const no=await makeFixture(20,3,false,false);fixture=no.root;rows.push(await observe('N20-noresource-publish-preflight',()=>publishInvestigationCandidates({workspaceRoot:no.root,ids:no.candidates,preflight:true})));await fs.rm(no.root,{recursive:true});
const files=['investigation-state-index.ts','query-index.ts','query-search-selection.ts','publish.ts','publish-preparation.ts','publish-selector.ts','publish-preparation-candidates.ts','candidate-document.ts','validation-collection.ts','relation-transaction-candidate.ts','relation-validation.ts','resources.ts','resource-root.ts'];const provenance={};for(const file of files){const bytes=await fs.readFile(`${repo}/tools/investigation-report/src/${file}`);provenance[file]=createHash('sha256').update(bytes).digest('hex');}const data={at:new Date().toISOString(),node:process.version,repo:'<repo-root>',head:cp.execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),experiment:experiment?'three-isolated-local-reuse-probes':'baseline',method:'Production files unchanged. Node registerHooks injects entry counters in-memory before native TS erasure; fs/JSON.parse/Date.parse/git primitive hooks group by caller stack. Counters only; no timing claims. local-reuse mode changes only in-memory current-wrapper return, candidate identity early return for already-complete layout, and list one-map reuse, to test output equivalence; not production implementation. Private OS-temp fixtures removed; setup excluded.',provenance,rows};await fs.writeFile(out,JSON.stringify(data,null,2)+'\n');console.log(out);for(const row of rows){const aggregate=Object.fromEntries(['readFile','readdir','JSON.parse','Date.parse','git'].map(kind=>[kind,Object.entries(row.groups).filter(([k])=>k.startsWith(kind+' | ')).reduce((s,[k,v])=>s+v.calls,0)]));console.log(JSON.stringify({name:row.name,...row.result,...aggregate,entry:Object.fromEntries(['parseReport','validateGraph','prepareResourceRoot','inspectLayout','filterRelations'].map(name=>[name,Object.entries(row.groups).filter(([k])=>k.startsWith('entry | '+name+' | ')).reduce((s,[k,v])=>s+v.calls,0)]))}));}

} finally {for(const root of allocatedFixtures)await fs.rm(root,{recursive:true,force:true});}
