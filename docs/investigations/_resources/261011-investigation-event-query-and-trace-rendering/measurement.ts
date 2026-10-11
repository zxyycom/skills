import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildStateIndex } from '../../tools/index-runtime/src/index.ts';
import { createInvestigationStateIndexDefinition } from '../../tools/investigation-report/src/investigation-index-definition.ts';
import { createInvestigationStateSnapshot } from '../../tools/investigation-report/src/investigation-index-source.ts';
import { traceInvestigationRelations as traceOld } from './main-before-production/tools/investigation-report/src/relation-validation.ts';
import { traceInvestigationRelations, validateInvestigationRelationGraph } from '../../tools/investigation-report/src/relation-validation.ts';
import { queryInvestigationIndex, traceInvestigationReports } from '../../tools/investigation-report/src/query.ts';
import { renderInvestigationTrace } from '../../tools/investigation-report/src/trace-output.ts';
import { buildRelationGraph, relationGraphStructuralIssues } from '../../tools/shared/src/graph/relations.ts';

const base = path.resolve('.log/investigation-relations-trace/opt-after-fixtures');
let stats: Record<string, number> = {};
let active = false;
function increment(k: string, n = 1) { stats[k] = (stats[k] ?? 0) + n; }
function stack() { return new Error().stack ?? ''; }
const natives = Object.fromEntries(['map','filter','some','sort','includes','indexOf','shift'].map(k => [k, Array.prototype[k]]));
for (const method of ['map','filter','some']) {
  Array.prototype[method] = function(callback, thisArg) {
    if (!active) return natives[method].call(this, callback, thisArg);
    const caller = stack();
    const keys: string[] = [];
    if (method === 'filter' && caller.includes('splitTraceEvent')) keys.push('splitBucketFilterVisits');
    if (method === 'filter' && caller.includes('mergeTraceEvent')) keys.push('mergeBucketFilterVisits');
    if (method === 'map' && caller.includes('buildRelationGraph')) keys.push('graphBuildEdgeMapVisits');
    if (method === 'map' && caller.includes('investigationRelationEdges')) keys.push('graphSourceEdgeOrStateMapVisits');
    if (method === 'filter' && caller.includes('relationSources')) keys.push('renderReverseFilterVisits');
    if (method === 'some' && caller.includes('addSuccessorNeighbours')) keys.push('renderDepthReverseSomeVisits');
    if (method === 'filter' && caller.includes('normalizeAdmissionUnit')) keys.push('normalizedTraceFilterVisits');
    if (method === 'filter' && caller.includes('selectRelationGraphTrace') && callback.toString().includes('!traceIds.has')) keys.push('budgetRecordFilterVisits');
    if (method === 'map' && caller.includes('compileFilter')) keys.push('compiledRequestedIdentityVisits');
    if (method === 'some' && caller.includes('matchesExact')) keys.push('compiledActualPredicateVisits');
    if (method === 'filter' && (caller.includes('appendSplitSuccessors') || caller.includes('appendSuccessors'))) keys.push('renderIndexedFilterVisits');
    if (method === 'some' && callback.name === 'has' && caller.includes('queryMaterializedStateIndex')) keys.push('exactAnyPredicateVisits');
    return natives[method].call(this, function(...args) {
      for (const key of keys) increment(key);
      return callback.apply(this, args);
    }, thisArg);
  };
}
Array.prototype.sort = function(compare) {
  const caller = active ? stack() : '';
  if ((caller.includes('sortRelationEdges') || compare?.name === 'compareRelationEdges') && compare)
    return natives.sort.call(this, function(a,b) { increment('graphEdgeSortComparisons'); return compare(a,b); });
  return natives.sort.call(this, compare);
};
Array.prototype.includes = function(value, fromIndex) {
  if (active && stack().includes('normalizeAdmissionUnits') && typeof value === 'string' && fromIndex === undefined) {
    const index = natives.indexOf.call(this, value);
    increment('admissionIncludesCalls');
    // 被测生产数组为 dense string IDs；仪器自身 membership 使用捕获的 native，避免自计数。
    // 这里记录生产调用的准确 native first-match 位置。
    increment('admissionIncludesLogicalComparisons', index === -1 ? this.length : index + 1);
  }
  return natives.includes.call(this, value, fromIndex);
};
Array.prototype.indexOf = function(value, fromIndex) {
  const found = natives.indexOf.call(this, value, fromIndex);
  if (active && stack().includes('/shared/src/graph/relations.ts')) {
    increment('cycleIndexOfCalls');
    increment('cycleIndexOfLogicalComparisons', found === -1 ? this.length : found + 1);
  }
  return found;
};
Array.prototype.shift = function() {
  if (active && stack().includes('traceDepths')) {
    increment('renderQueueShiftCalls');
    increment('renderQueueRemainingCells', Math.max(0,this.length-1));
  }
  return natives.shift.call(this);
};

const NativeSet = globalThis.Set;
globalThis.Set = class MeasuredSet<T> extends NativeSet<T> {
  constructor(input?: Iterable<T> | null) {
    const caller = active ? stack() : '';
    super(input);
    const length = Array.isArray(input) ? input.length : input instanceof NativeSet ? input.size : 0;
    for (const [name, needle] of [['normalization','normalizeAdmissionUnit'],['compiledRequested','compileFilter'],['admissionTrace','selectRelationGraphTrace']] as const) {
      if (caller.includes(needle)) { increment(name+'SetConstructions'); increment(name+'SetInputItems',length); }
    }
  }
  add(value:T) {
    if (active) {
      const caller = stack();
      if (caller.includes('/investigation-report/src/relation-validation.ts') && caller.includes('selectRelationGraphTrace')) increment('domainAdmissionUnitAddVisits');
    }
    return super.add(value);
  }
  has(value:T) {
    if (active) {
      const caller = stack();
      if (caller.includes('normalizeAdmissionUnit')) increment('normalizationMembershipProbes');
      if (caller.includes('matchesExact')) increment('compiledExactMembershipProbes');
      if (caller.includes('addSuccessorNeighbours')) increment('renderDepthIndexedEdgeVisits');
      if (caller.includes('selectRelationGraphTrace')) increment('admissionSetMembershipProbes');
    }
    return super.has(value);
  }
};
const nativeJoin = Array.prototype.join;
Array.prototype.join = function(...args) {
  if (active && stack().includes('normalizeAdmissionUnit')) { increment('normalizedIdentityJoins'); increment('normalizedIdentityJoinItems',this.length); }
  return nativeJoin.apply(this,args);
};
const nativeFreeze=Object.freeze;
Object.freeze=function(value) {
  if(active && (stack().includes('frozenTraceEvent') || (value && typeof value === 'object' && Object.hasOwn(value,'predecessors') && Object.hasOwn(value,'successors') && value.predecessors?.recordIds === value.successors?.recordIds))) { increment('eventFreezeCalls'); if(Array.isArray(value)) increment('eventFreezeArrayItems',value.length); }
  return nativeFreeze(value);
};
const nativeGetOwnPropertyDescriptor=Object.getOwnPropertyDescriptor;
Object.getOwnPropertyDescriptor=function(value,key) {
  if(active) {
    const caller=stack();
    if(caller.includes('hasStableAdmissionData')&&natives.includes.call(['kind','recordIds','traceIds'],String(key)))increment('admissionStableUnitDescriptorReads');
    if(caller.includes('hasStableIdArray')&&typeof key==='number')increment('admissionStableArrayIndexedDescriptorReads');
    if(caller.includes('hasStandardArrayIterator'))increment('admissionStandardIteratorDescriptorReads');
  }
  return nativeGetOwnPropertyDescriptor(value,key);
};
const nativeIsFrozen=Object.isFrozen;
Object.isFrozen=function(value) {
  if(active) {
    const caller=stack();
    if(caller.includes('hasStableAdmissionData')&&!caller.includes('hasStableIdArray'))increment('admissionStableUnitFreezeCalls');
    if(caller.includes('hasStableIdArray'))increment('admissionStableArrayFreezeCalls');
    if(caller.includes('hasStableIdArray')&&Array.isArray(value))increment('admissionStableFrozenArrayInputItems',value.length);
  }
  return nativeIsFrozen(value);
};
const nativeGet=Map.prototype.get;
Map.prototype.get=function(key) {
  if(active){const caller=stack();if(caller.includes('reverseTraceRelations'))increment('renderIndexBuildEdgeVisits');if(caller.includes('addSuccessorNeighbours'))increment('renderDepthBucketProbes');if(caller.includes('appendSplitSuccessors')||caller.includes('appendSuccessors'))increment('renderOutputBucketProbes');}
  return nativeGet.call(this,key);
};
const nativeWeakGet=WeakMap.prototype.get;
WeakMap.prototype.get=function(key) {
  const found=nativeWeakGet.call(this,key);
  if(active&&stack().includes('normalizeAdmissionUnit'))increment(found===undefined?'normalizationCacheMisses':'normalizationCacheHits');
  return found;
};
const nativeWeakHas=WeakSet.prototype.has;
WeakSet.prototype.has=function(key) {
  const found=nativeWeakHas.call(this,key);
  if(active&&stack().includes('selectRelationGraphTrace'))increment(found?'admittedUnitSkipHits':'admittedUnitFirstVisits');
  return found;
};

function state(id: string, relations: any[] = []) {
  return { name: id, title: id, formedAt: '2026-10-11T00:00:00Z', question: 'Q', tags: ['measure'], sourcePath: id+'.md', resourceIds: [], relations };
}
function fixture(kind: 'split'|'merge'|'star'|'chain', size: number) {
  const states = new Map<string, any>([['anchor', state('anchor')]]);
  const id = (i: number) => `node-${String(i).padStart(5,'0')}`;
  for (let i=0;i<size;i++) {
    const target = kind === 'chain' && i > 0 ? id(i-1) : 'anchor';
    states.set(id(i), state(id(i), kind === 'merge' ? [] : [{ type: kind === 'split' ? '拆分' : '复查', target }]));
  }
  if (kind === 'merge') states.set('anchor',state('anchor',Array.from({length:size},(_,i)=>({type:'归并',target:id(i)}))));
  assert.deepEqual(validateInvestigationRelationGraph(states), []);
  return states;
}
async function publishPrivateIndex(label: string, states: Map<string, any>) {
  const root = path.join(base,label);
  const dir = path.join(root,'docs/investigations');
  await fs.mkdir(dir,{recursive:true});
  const sources = [...states].map(([id,s])=>({id,sourcePath:s.sourcePath,text:JSON.stringify(s)}));
  const snapshot = createInvestigationStateSnapshot(sources,[...states.values()]);
  const built = await buildStateIndex(createInvestigationStateIndexDefinition({snapshot}),{root});
  assert.equal(built.status,'ok',JSON.stringify(built.diagnostics));
  await fs.writeFile(path.join(dir,'investigation-index.json'),JSON.stringify(built.value));
  return root;
}
async function measured(label: string, operation: ()=>Promise<any>) {
  stats={}; active=true;
  try { const result=await operation(); return {label,...stats,...result}; }
  finally {active=false;}
}
const results:any[]=[];
for (const kind of ['split','merge'] as const) for (const d of [40,80,160]) {
  const states=fixture(kind,d);
  results.push(await measured(`${kind}-d${d}-budget50`,async()=>{
    const root=await publishPrivateIndex(`${kind}-${d}`,states);
    const trace=await traceInvestigationReports({workspaceRoot:root,id:'anchor',direction:kind==='split'?'successors':'predecessors',maxDepth:null,maxRecords:50});
    assert.equal(trace.status,'ok');
    return {d,V:states.size,E:d,traceRecords:trace.traceIds.length+trace.contextIds.length,blocked:trace.blockedEvent?.requiredMaxRecords,frontierIds:trace.frontier.reduce((n,f)=>n+f.nextIds.length,0)};
  }));
}
for (const kind of ['chain','star'] as const) for (const n of [50,100,200]) {
  const states=fixture(kind,n);
  results.push(await measured(`render-${kind}-n${n}`,async()=>{
    const root=await publishPrivateIndex(`render-${kind}-${n}`,states);
    const trace=await traceInvestigationReports({workspaceRoot:root,id:'anchor',direction:'successors',maxDepth:null,maxRecords:n+1});
    assert.equal(trace.status,'ok');
    assert.equal(trace.traceIds.length,n+1);
    const rendered=renderInvestigationTrace(trace);
    return {T:trace.traceIds.length,A:Object.keys(trace.entries).length,L:n,outputBytes:Buffer.byteLength(rendered)};
  }));
}
for (const n of [50,100,200]) {
  const states=fixture('star',n);
  // Add n isolated reports, retaining valid ordinary direct relations in the star.
  for(let i=0;i<n;i++) {const id=`isolated-${String(i).padStart(5,'0')}`; states.set(id,state(id));}
  results.push(await measured(`list-related-n${n}-m${n}`,async()=>{
    const root=await publishPrivateIndex(`list-${n}`,states);
    const queried=await queryInvestigationIndex({workspaceRoot:root,relatedTo:'anchor',direction:'successors',limit:1});
    assert.deepEqual(queried.errors,[]);
    assert.equal(queried.total,n); assert.equal(queried.entries.length,1);
    return {N:states.size,M:n,total:queried.total,returned:queried.entries.length};
  }));
}
for (const kind of ['split','merge'] as const) for (const d of [40,80,160]) {
  const states=fixture(kind,d);
  for (const anchor of ['anchor','node-00000','node-'+String(d-1).padStart(5,'0')]) for(const maxDepth of [0,1,null]) for(const maxRecords of [d,d+1]) {
    const options={direction:'both' as const,maxDepth,maxRecords};
    const old=traceOld(states,anchor,options);
    results.push(await measured(`${kind}-both-d${d}-${anchor}-depth${maxDepth}-budget${maxRecords}`,async()=>{
      const current=traceInvestigationRelations(states,anchor,options);assert.deepEqual(current,old);
      return {d,V:states.size,E:d,traceRecords:current.traceIds.length+current.contextIds.length,traceIds:current.traceIds.length,contextIds:current.contextIds.length,blocked:current.blockedEvent?.requiredMaxRecords,frontierIds:current.frontier.reduce((n,f)=>n+f.nextIds.length,0),equalOldCompleteResult:true};
    }));
  }
}
console.log(JSON.stringify({HEAD:'a01efb41f9c7863e9c6102c3ceefc4c1ada20922',bunNodeCompatibilityVersion:process.version,bun:typeof Bun === 'undefined' ? null : Bun.version,method:'Direct unmodified production TS imports; private synthetic published indexes only. Counts scoped to named production call stacks; instrumentation membership bypasses patched methods via captured natives to exclude self-counts; new counters include first own-data/dense-array proof descriptor reads and frozen-array input volumes, O(1) inherited-iterator guard probes, per-event aggregation/freeze, first normalization/identity, success/blocked budget scans, cache/skip probes, compiled requested construction and actual probes, renderer reverse-index build and adjacency; graph construction happens inside all measured trace calls. Includes/indexOf comparison counts are native first-match positions for dense string arrays. Queue remaining cells are an abstract work signal, not measured V8/JSC memory movement. No CPU/latency claims.',results},null,2));
