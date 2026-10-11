import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildRelationGraph, selectRelationGraphTrace } from '../../tools/shared/src/graph/relations.ts';
import type { RelationGraphTraceAdmissionUnit, RelationGraphTraceEventKind, RelationGraphTraceSelectionOptions } from '../../tools/shared/src/graph/trace-contract.ts';
import { selectRelationGraphTrace as oldSelect } from './main-before-production/tools/shared/src/graph/relations.ts';
const variants=['unit-trace','unit-record','unit-kind','inherited-fields','array-index','array-iterator','inherited-iterator'] as const;
function run(select:typeof selectRelationGraphTrace,variant:typeof variants[number],options:RelationGraphTraceSelectionOptions) {
 const graph=buildRelationGraph<string,string>(['anchor','a','b'],[]);
 let kind:RelationGraphTraceEventKind='ordinary';
 let records=Object.freeze(variant==='unit-record'||variant==='unit-kind'||variant==='inherited-fields'?['anchor','a']:['anchor','a','b']);
 let targets=Object.freeze(['a']);
 let target='a';
 const iteratorDescriptor=Object.getOwnPropertyDescriptor(Array.prototype,Symbol.iterator)!;
 const originalIterator=Array.prototype[Symbol.iterator];
 let unit:RelationGraphTraceAdmissionUnit<string>;
 if(variant==='unit-trace')unit=Object.freeze({kind:'merge',recordIds:records,get traceIds(){return targets;}});
 else if(variant==='unit-record')unit=Object.freeze({kind:'merge',get recordIds(){return records;},traceIds:Object.freeze(['a','b'])});
 else if(variant==='unit-kind')unit=Object.freeze({get kind(){return kind;},get recordIds(){return records;},get traceIds(){return targets;}});
 else if(variant==='inherited-fields'){
  class InheritedUnit {get kind(){return kind;}get recordIds(){return records;}get traceIds(){return targets;}}
  unit=Object.freeze(new InheritedUnit());
 }else{
  const ids=['a'];
  if(variant==='array-index')Object.defineProperty(ids,'0',{get:()=>target});
  if(variant==='array-iterator')Object.defineProperty(ids,Symbol.iterator,{value:function*(){yield target;}});
  targets=Object.freeze(ids);
  unit=Object.freeze({kind:'merge',recordIds:records,traceIds:targets});
 }
 try {
  return select(graph,'anchor',options,({fromId})=>{
   if(fromId==='anchor')return [unit];
   if(fromId==='a'){
    kind='split';records=Object.freeze(['anchor','a','b']);target='b';
    if(variant==='inherited-iterator')Object.defineProperty(Array.prototype,Symbol.iterator,{...iteratorDescriptor,value:function*(this:readonly string[]){if(this===targets)yield 'b';else yield* originalIterator.call(this);}});
    else if(variant==='unit-trace'||variant==='unit-kind'||variant==='inherited-fields')targets=Object.freeze(['b']);
    return [unit];
   }
   return [];
  });
 }finally{Object.defineProperty(Array.prototype,Symbol.iterator,iteratorDescriptor);}
}
const results:any[]=[];
for(const variant of variants)for(const direction of ['predecessors','successors','both'] as const)for(const maxDepth of [0,1,null])for(const maxRecords of [1,2,3]){
 const options={direction,maxDepth,maxRecords};
 const before=run(oldSelect,variant,options),after=run(selectRelationGraphTrace,variant,options);
 assert.deepEqual(after,before,JSON.stringify({variant,options}));
 results.push({variant,options,before,after});
}
const complete=JSON.stringify(results,null,2)+'\n';
await fs.writeFile('.log/investigation-relations-trace/opt-snapshot-oracle-complete.json',complete);
const summary={bun:Bun.version,checks:results.length,variants,allCompleteOutputsEqual:true,completeOutputsSha256:createHash('sha256').update(complete).digest('hex')};
await fs.writeFile('.log/investigation-relations-trace/opt-snapshot-oracle-results.json',JSON.stringify(summary,null,2)+'\n');
console.log(summary);
