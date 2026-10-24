// Independent, short-lived review probes. Run from repository root; not a test:* entry.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const base = new URL('../../../../tools/', import.meta.url);
const { RecordVerificationPhase } = await import(new URL('record-operations/src/transaction-verification.ts', base));
const { normalizeRecordTransactionPlan } = await import(new URL('record-operations/src/transaction-plan.ts', base));
const { runRecordTransaction } = await import(new URL('record-operations/src/transaction.ts', base));
const { readRecordFileSnapshot, writeRecordFile } = await import(new URL('record-operations/src/transaction-files.ts', base));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'record-rename-review-'));
await fs.writeFile(path.join(root, '.review-owned'), 'rename_alignment_review; ephemeral fault fixtures, safe to remove after probes\n');
let count = 0;
async function probe(name, fn) { await fn(); console.log(`PASS ${++count}: ${name}`); }
const a = path.join(root, 'a.md');
const index = path.join(root, 'index.json');
await fs.writeFile(a, 'before', { mode: 0o640 });
await fs.writeFile(index, 'old-index', { mode: 0o600 });
const before = await readRecordFileSnapshot(root, a);
const stages = { fresh: async () => {}, verify: async () => {}, verifyRecovered: async () => {} };
try {
await probe('normalizer rejects canonical duplicate and invalid unchanged permissions before writes', async () => {
 const unchanged = { path: a, before, next: Buffer.from('before') };
 assert.throws(() => normalizeRecordTransactionPlan({value:null,root,writes:[unchanged,{...unchanged,path:root+'/./a.md'}],index:null}), /duplicate/);
 assert.throws(() => normalizeRecordTransactionPlan({value:null,root,writes:[{...unchanged,mode:0o640,creationMode:0o666}],index:null}), /Native creation mode/);
 const sameIndex = {path:index,before:await readRecordFileSnapshot(root,index),next:Buffer.from('old-index')};
 const normalized = normalizeRecordTransactionPlan({value:null,root,writes:[unchanged],index:sameIndex});
 assert.equal(normalized.writes.length,0); assert.equal(normalized.guards.length,1); assert.equal(normalized.index,sameIndex);
 assert.equal(await fs.readFile(a,'utf8'),'before');
});
await probe('domain snapshot deep copy cannot poison phase actual observation; root is exact', async () => {
 const phase = new RecordVerificationPhase(root); let captured;
 await phase.captureTextSnapshots(root,[a],result=>{assert.equal(result.ok,true);captured=result.value;});
 captured.snapshot.bytes[0] ^= 1;
 captured.snapshot.parents[0].ino += 1;
 await assert.rejects(phase.verify(a,captured.snapshot),/member changed/);
 await phase.verify(a,before);
 await assert.rejects(phase.captureTextSnapshots(path.dirname(root),[a],()=>{}),/root does not match/);
});
await probe('batch scheduler retains alias conflicts and ordered failures, not expected-object identity', async () => {
 const phase = new RecordVerificationPhase(root);
 const bad={...before,mode:before.mode^0o100};
 const entries=Array.from({length:1000},()=>({path:a,before:{...before,bytes:Buffer.from(before.bytes)}}));
 entries[1]={path:root+'/./a.md',before:bad};
 entries[2]={path:path.join(root,'missing.md'),before};
 const failures=[];
 await phase.verifyMany(entries,(failure,i)=>failures.push([failure.kind,i]));
 assert.deepEqual(failures,[['changed',1],['changed',2]]);
 await assert.rejects(new RecordVerificationPhase(root).verifyMany(entries),/member changed/);
});
await probe('worker text acquisition rejects UTF8, symlink and missing without caching failed facts', async () => {
 const invalid=path.join(root,'invalid.md'), link=path.join(root,'link.md');
 await fs.writeFile(invalid,Buffer.from([0xff])); await fs.symlink(a,link);
 const targets=[invalid,link,path.join(root,'missing.md'),...Array.from({length:997},()=>a)];
 const phase=new RecordVerificationPhase(root); const results=[];
 await phase.captureTextSnapshots(root,targets,(result,i)=>{if(i<3)results.push(result);else assert.equal(result.ok,true);});
 assert.deepEqual(results.map(r=>r.ok),[false,false,false]);
 assert.match(results[0].error.message,/encoded data/);assert.match(results[1].error.message,/regular non-symbolic-link/);assert.equal(results[2].error.code,'ENOENT');
 await assert.rejects(phase.verify(invalid,before),/member changed/);
});
await probe('postcommit independent phase detects inode winner on normalized unchanged guard',async()=>{
 const guard={path:a,before,next:Buffer.from(before.bytes)};
 const indexWrite={path:index,before:await readRecordFileSnapshot(root,index),next:Buffer.from('new-index')};
 let winnerInode;
 const result=await runRecordTransaction({...stages,prepare:async()=>normalizeRecordTransactionPlan({value:null,root,writes:[guard],index:{...indexWrite,write:async()=>{
  const identity=await writeRecordFile(root,indexWrite);
  const winner=a+'.winner';await fs.writeFile(winner,'before',{mode:before.mode});await fs.rename(winner,a);winnerInode=(await fs.stat(a)).ino;return identity;
 }}})});
 assert.equal(result.status,'error');assert.equal(result.committed,true);assert.equal(result.changed,true);assert.equal(result.verification,'failed-or-unknown');assert.equal(result.outcome,'partial-or-unknown');assert.equal((await fs.stat(a)).ino,winnerInode);assert.equal(await fs.readFile(index,'utf8'),'new-index');
});
await probe('IR beforePublish aggregates source/index drift and preserves source and target winners',async()=>{
 const {writeCollection}=await import(new URL('investigation-report/tests/collection-support.ts',base));
 const {investigationRoot}=await import(new URL('investigation-report/tests/fixture-support.ts',base));
 const {renameInvestigationRecordWithHooks}=await import(new URL('investigation-report/src/rename.ts',base));
 const workspace=path.join(root,'workspace');await fs.mkdir(workspace);
 await writeCollection(workspace,[{id:'legacy'},{id:'untouched'}]);
 const dir=investigationRoot(workspace), idx=path.join(dir,'investigation-index.json'), target=path.join(dir,'renamed.md');
 const result=await renameInvestigationRecordWithHooks({workspaceRoot:workspace,source:'legacy',target:'renamed'},{beforePublish:async()=>{
  await fs.appendFile(path.join(dir,'legacy.md'),'\nexternal source\n');await fs.appendFile(idx,'\nexternal index\n');await fs.writeFile(target,'target winner');
 }});
 assert.equal(result.status,'error');assert.equal(result.changed,false);
 assert.match(result.errors.join(';'),/legacy changed after rename validation/);assert.match(result.errors.join(';'),/index changed after rename validation/);assert.match(result.errors.join(';'),/target path already exists/);
 assert.equal(await fs.readFile(target,'utf8'),'target winner');assert.match(await fs.readFile(idx,'utf8'),/external index/);assert.match(await fs.readFile(path.join(dir,'legacy.md'),'utf8'),/external source/);
});
await probe('fresh resource files preserve binary bytes, reject file and directory mode/inode drift, and isolate later direct checks',async()=>{
 const {prepareResourceSourceProof,verifyResourceSourceProof}=await import(new URL('investigation-report/src/rename-resource-proof.ts',base));
 const owner=path.join(root,'owner');await fs.mkdir(owner);const binary=path.join(owner,'evidence.bin');await fs.writeFile(binary,Buffer.from([0xff,0x00]),{mode:0o640});
 const options={root,owner,files:[{path:'evidence.bin',mode:0o640}],directories:['']};
 const progress=await prepareResourceSourceProof(options);
 await verifyResourceSourceProof(root,owner,progress,new RecordVerificationPhase(root));
 for(const minimal of [progress,{sourceDirectories:progress.sourceDirectories},{}])
  await assert.rejects(verifyResourceSourceProof(path.dirname(root),owner,minimal,new RecordVerificationPhase(root)),/root does not match/);
 await fs.chmod(binary,0o600);
 await assert.rejects(verifyResourceSourceProof(root,owner,progress,new RecordVerificationPhase(root)),/member changed/);await fs.chmod(binary,0o640);
 const replacement=binary+'.winner';await fs.writeFile(replacement,Buffer.from([0xff,0x00]),{mode:0o640});await fs.rename(replacement,binary);
 await assert.rejects(verifyResourceSourceProof(root,owner,progress,new RecordVerificationPhase(root)),/member changed/);
 const current=await prepareResourceSourceProof(options);const phase=new RecordVerificationPhase(root);await verifyResourceSourceProof(root,owner,current,phase);
 await fs.chmod(owner,0o700 ^ 0o040);await assert.rejects(verifyResourceSourceProof(root,owner,current,new RecordVerificationPhase(root)),/directory identity\/mode changed/);
 await fs.chmod(owner,current.sourceDirectories.get('').mode);await fs.writeFile(binary,'later');
 await assert.rejects(verifyResourceSourceProof(root,owner,current),/member changed/);assert.equal(await fs.readFile(binary,'utf8'),'later');
});
await probe('prepare resource queue preserves ordered missing/mode failure before directory acquisition, including worker-sized binary reads',async()=>{
 const {prepareResourceSourceProof}=await import(new URL('investigation-report/src/rename-resource-proof.ts',base));
 const owner=path.join(root,'prepare-owner');await fs.mkdir(owner);await fs.writeFile(path.join(owner,'a.bin'),Buffer.from([0xff]),{mode:0o640});
 const common={root,owner,directories:['missing-directory']};
 await assert.rejects(prepareResourceSourceProof({...common,files:[{path:'first-missing'},{path:'a.bin',mode:0o600}]}),/mode: first-missing$/);
 await assert.rejects(prepareResourceSourceProof({...common,files:[{path:'a.bin',mode:0o600},{path:'first-missing'}]}),/mode: a.bin$/);
 const prepared=await prepareResourceSourceProof({root,owner,directories:[''],files:Array.from({length:1000},()=>({path:'a.bin',mode:0o640}))});
 assert.deepEqual(Buffer.from(prepared.sourceFiles.get('a.bin').bytes),Buffer.from([0xff]));assert.equal(prepared.sourceFiles.get('a.bin').mode,0o640);assert.equal(prepared.sourceDirectories.size,1);
});
console.log(JSON.stringify({passed:count,fixtureRoot:root,cleanup:'scheduled in finally'}));
} finally {await fs.rm(root,{recursive:true,force:true});}
