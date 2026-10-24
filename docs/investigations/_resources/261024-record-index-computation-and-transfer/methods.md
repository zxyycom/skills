# 形成时方法阅读副本
这些是本轮实际方法，不是项目长期CLI或完整重放包。固定输入模板来自 Git `563119ef:changes/localize-record-operations/validation/replay-bundle.tar.gz` 的 `methods/input-templates/`；同一包保存原计数器与独立oracle来源。源码为 provenance 中固定版本；代码中的路径表示形成时运行布局。
## 方法导航
- `freeze.py`：见下方同名章节。
- `closure.mjs`：见下方同名章节。
- `recreate-inputs.py`：见下方同名章节。
- `prepare.py`：见下方同名章节。
- `prototype.py`：见下方同名章节。
- `small-controls.mjs`：见下方同名章节。
- `run.py`：见下方同名章节。
- `instrument.py`：见下方同名章节。
- `preload.mjs`：见下方同名章节。
- `oracle.py`：见下方同名章节。
- `summarize.py`：见下方同名章节。
- `payload-proof.py`：见下方同名章节。

## `freeze.py`
源文件 3325 字节，SHA-256 `3862f232d74e885ecf1df97058f52b994f82ba42bc64bfbdea85d72a358ae3c6`。 下方为完整内容。
`````python
from pathlib import Path
import subprocess,shutil,hashlib,json,os
R=Path(__file__).resolve().parents[1];W=Path('/workspace/skills')
paths=['tools/decision-records','tools/investigation-report','tools/record-operations','tools/index-runtime','tools/shared','skills/decision-records','skills/investigation-report','package.json','pnpm-lock.yaml']
def manifest(base,rels):
 out={}
 for rel in rels:
  p=base/rel
  fs=[p] if p.is_file() else [Path(d)/f for d,ns,fs in os.walk(p,followlinks=False) for f in ns+fs if (Path(d)/f).is_symlink() or (Path(d)/f).is_file()]
  for p in fs:
   out[str(p.relative_to(base))]={'link':os.readlink(p)} if p.is_symlink() else {'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mode':p.stat().st_mode&0o777}
 return out
def fingerprint(v):return hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()
if __name__=='__main__':
 before=R/'before';before.mkdir();source=manifest(W,paths)
 for rel in paths:
  p=W/rel;t=before/rel;t.parent.mkdir(parents=True,exist_ok=True)
  if p.is_dir():shutil.copytree(p,t,symlinks=True)
  else:shutil.copy2(p,t)
 dependencySource=manifest(W,['node_modules']);shutil.copytree(W/'node_modules',before/'node_modules',symlinks=True);assert dependencySource==manifest(W,['node_modules'])==manifest(before,['node_modules'])
 optionalSource=Path('/tmp/node_modules/supports-color');optionalStart=manifest(optionalSource.parent,['supports-color']);assert not (before/'node_modules/supports-color').exists();shutil.copytree(optionalSource,before/'node_modules/supports-color',symlinks=True);assert optionalStart==manifest(optionalSource.parent,['supports-color'])==manifest(before/'node_modules',['supports-color']);(R/'optional-start-manifest.json').write_text(json.dumps(optionalStart,sort_keys=True))
 assert source==manifest(W,paths)==manifest(before,paths)
 deps=manifest(before,['node_modules']);(R/'source-manifest.json').write_text(json.dumps(source,sort_keys=True));(R/'dependency-manifest.json').write_text(json.dumps(deps,sort_keys=True))
 after=R/'after';after.mkdir()
 for rel in paths:
  p=before/rel;t=after/rel;t.parent.mkdir(parents=True,exist_ok=True)
  if p.is_dir():shutil.copytree(p,t,symlinks=True)
  else:shutil.copy2(p,t)
 (after/'node_modules').symlink_to('../before/node_modules')
 subprocess.run(['python',str(R/'methods/prototype.py'),str(after)],check=True)
 env={'head':subprocess.check_output(['git','-C',str(W),'rev-parse','HEAD']).decode().strip(),'sourceFingerprint':fingerprint(source),'dependencyFingerprint':fingerprint(deps),'sourceFileCount':len(source),'dependencyFileCount':len(deps),'node':subprocess.check_output(['node','--version']).decode().strip(),'git':subprocess.check_output(['git','--version']).decode().strip(),'bun':'1.4.2','optionalPackage':'supports-color 9.4.0 copied from actual host optional package, source/frozen manifests equal at freeze','skillVersions':{d:__import__('re').search(r'version: \"(\d+)\"',(W/'skills'/d/'SKILL.md').read_text()).group(1) for d in ['decision-records','investigation-report']},'cgroup':{p:Path('/sys/fs/cgroup/'+p).read_text().strip() for p in ['cpu.max','memory.max']},'nodeSha256':hashlib.sha256(Path(shutil.which('node')).read_bytes()).hexdigest()}
 (R/'environment.json').write_text(json.dumps(env,indent=2)+'\n');print(json.dumps(env))

`````

## `closure.mjs`
源文件 405 字节，SHA-256 `04cdc523896c2d9a2a69612945fecb38fedfb2237bed6166904172d0470afc6d`。 下方为完整内容。
`````javascript
// Pre-formal loader observation. Not imported by normal timed samples.
import { registerHooks } from 'node:module';
import { appendFileSync } from 'node:fs';
registerHooks({resolve(specifier, context, nextResolve){
 const result=nextResolve(specifier,context);
 if(result.url.startsWith('file:')) appendFileSync(process.env.INDEX_COST_CLOSURE,JSON.stringify({url:result.url})+'\n');
 return result;
}});

`````

## `recreate-inputs.py`
源文件 2591 字节，SHA-256 `183c8f0ab04a451195d989dc7c4bb251e6e022147eee833b0f5b2bea317078e3`。 下方为完整内容。
`````python
"""Recreate exact 10k domain input bytes without retaining large indexes or original /tmp Git."""
from pathlib import Path
import json,sys
from oracle import projection,fingerprint,stable
T=Path(__file__).resolve().parent/'input-templates'
def generate(destination):
 assert not destination.exists(),'Refuse overwrite'
 for d,coll in [('decision','docs/decisions'),('investigation','docs/investigations')]:
  c=destination/d/coll;c.mkdir(parents=True)
  entries={};revisions={}
  for n in range(1,10001):
   i=f'261001-record-{n:05d}';base='261001-record-00001' if d=='decision' else '261001-record-00002'
   text=(T/(d+'-formal.md')).read_text().replace(base,i)
   if d=='decision':
    text=text.replace('status: "archived"','status: "active"' if n>9000 else 'status: "archived"')
    text=text.replace('alignment: "unaligned"','alignment: "aligned"' if n%2==0 else 'alignment: "unaligned"')
   if n>1000:
    kind='修订' if d=='decision' else '补充';pred=f'261001-record-{n-1000:05d}'
    text=text.replace('relations: []',f'relations:\n  - type: "{kind}"\n    target: "{pred}"')
   if d=='investigation' and n==1:text+='\n## 随附资源\n- [证据](./_resources/261001-record-00001/evidence.txt)\n'
   if n==10000:text+='needle-perf-unique\n\n'
   source=('archive/' if d=='decision' and n<=9000 else '')+i+'.md'
   p=c/source;p.parent.mkdir(exist_ok=True);p.write_text(text);p.chmod(0o644)
   _,entry,rev=projection(d,source,text.encode())
   if d=='decision':entry={k:entry[k] for k in ['name','sourcePath','title','status','alignment','createdAt','purpose','background','decision','tags','relations']}
   entries[i]=entry;revisions[i]=rev
  for n in [1,2]:
   i=f'261001-candidate-{n}';text=(T/(d+'-candidate.md')).read_text().replace('261001-candidate-1',i)
   (c/(i+'.md' if d=='decision' else '_candidate.'+i)).write_text(text)
  label='decision-index-metadata-v2' if d=='decision' else 'investigation-index-metadata-v4'
  index={'schemaVersion':4,'namespace':'decisions' if d=='decision' else 'investigations','definitionVersion':11,'metadata':{},'sourceRevision':{'entries':revisions,'metadata':fingerprint(label,'{}')},'entries':entries}
  (c/('decision-index.json' if d=='decision' else 'investigation-index.json')).write_text(json.dumps(index,ensure_ascii=False,indent=2,sort_keys=d=='investigation')+'\n')
  if d=='investigation':
   p=c/'_resources/261001-record-00001/evidence.txt';p.parent.mkdir(parents=True);p.write_bytes((T/'evidence.txt').read_bytes())
  for f in c.rglob('*'):
   if f.is_file():f.chmod(0o644)
if __name__=='__main__':generate(Path(sys.argv[1]))

`````

## `prepare.py`
源文件 2732 字节，SHA-256 `3e1d3d285638e80dd7f09bb1431c0165631ef158261a881a92637c8a54306aa5`。 下方为完整内容。
`````python
from pathlib import Path
import json,os,subprocess,sys,shutil
from oracle import collection,index_name,projection,capture,verify_index,summary,stable,git
R=Path(__file__).resolve().parents[1];Z='261001-record-10000';U='261001-record-09999'
os.environ.update(GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null',GIT_AUTHOR_DATE='2026-10-01T00:00:00Z',GIT_COMMITTER_DATE='2026-10-01T00:00:00Z')
def write_idx(d,p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2,sort_keys=d=='investigation')+'\n')
def modify(d,idx,i,title):
 src=idx['entries'][i]['sourcePath'];text=(R/'templates'/d/collection(d)/src).read_text();text=text.replace(idx['entries'][i]['title'],title)
 _,entry,rev=projection(d,src,text.encode())
 if d=='decision':entry={k:entry[k] for k in ['name','sourcePath','title','status','alignment','createdAt','purpose','background','decision','tags','relations']}
 idx['entries'][i]=entry;idx['sourceRevision']['entries'][i]=rev
 return src,text
if __name__=='__main__':
 subprocess.run(['python',str(R/'methods/recreate-inputs.py'),str(R/'templates')],check=True)
 proofs=[]
 for d in ['decision','investigation']:
  root=R/'templates'/d
  for args in [('init','-q'),('config','core.hooksPath','/dev/null'),('config','user.name','Index Cost Fixture'),('config','user.email','fixture@example.invalid'),('add','.'),('commit','-qm','Synthetic 10k baseline')]:git(root,*args)
  s=capture(root,d);v=verify_index(root,d,s);proofs.append({'domain':d,'initial':summary(s),'verification':v,'indexBytes':s['files'][collection(d)+'/'+index_name(d)]['bytes']})
 (R/'fixture-proof.json').write_text(json.dumps(proofs,indent=2)+'\n')
def restore(d,scenario):
 root=R/'work'/d
 if not root.exists():root.parent.mkdir(exist_ok=True);shutil.copytree(R/'templates'/d,root)
 git(root,'reset','--hard','-q','HEAD');git(root,'clean','-fdq')
 c=root/collection(d);p=c/index_name(d);idx=json.loads(p.read_bytes());src,text=modify(d,idx,Z,'Selected title refreshed')
 (c/src).write_text(text)
 if scenario=='sync-selected':return root
 write_idx(d,p,idx)
 pending=json.loads((R/'templates'/d/collection(d)/index_name(d)).read_bytes());modify(d,pending,U,'Pending unrelated title retained');working=p.read_bytes();write_idx(d,p,pending);git(root,'add',collection(d)+'/'+index_name(d));p.write_bytes(working)
 # A noncollection path and a changed unselected domain source exercise complete pending identity preservation.
 sentinel=root/'unrelated-sentinel.txt';sentinel.write_text('preserve outside scope\n');git(root,'add','unrelated-sentinel.txt')
 unselected=c/idx['entries'][U]['sourcePath'];unselected.write_text(unselected.read_text()+'\nUnselected staged body only.\n');git(root,'add',str(unselected.relative_to(root)))
 return root

`````

## `prototype.py`
源文件 957 字节，SHA-256 `90f48273a39af2301dd81a400f0397871e630db81ebeb09de084a8074117e62b`。 下方为完整内容。
`````python
"""Isolated experiment: only freeze the operation-owned decoded envelope in place."""
from pathlib import Path
import sys
root=Path(sys.argv[1]);copies=list(root.glob('skills/*/scripts/runtime/tools/index-runtime/src/snapshot-parser.ts'))+[root/'tools/index-runtime/src/snapshot-parser.ts']
for p in copies:
 if not p.exists():continue
 s=p.read_text();needle='value: cloneAndFreezeTypedJsonObject(validated.index, false)';assert s.count(needle)==1
 s=s.replace('import { cloneAndFreezeTypedJsonObject } from "./frozen-json.ts";\n','')
 s=s.replace(needle,'value: freezeOwnedEnvelope(validated.index)')
 s+='''\n/** Experiment only: all descendants originate in this invocation's JSON parse/schema. */
function freezeOwnedEnvelope<Value>(value: Value): Value {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeOwnedEnvelope(child);
    Object.freeze(value);
  }
  return value;
}
'''
 p.write_text(s)

`````

## `small-controls.mjs`
源文件 3779 字节，SHA-256 `df7baf0a49ee933517210c2399adaf3fc846cdbc4b232a6ff1138cebdea33b7b`。 下方为完整内容。
`````javascript
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.argv[2];const results=[];
function frozen(v){return v===null||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(frozen)}
for(const variant of ['before','after']){
 const {parseStateIndex,parseStateIndexEnvelope,serializeStateIndex}=await import(pathToFileURL(`${root}/${variant}/tools/index-runtime/src/snapshot-parser.ts`));
 const calls=[];const definition={namespace:'probe',definitionVersion:1,queryFields:[{name:'title',mode:'text',sources:[{kind:'state-path',path:['title']}]}],parseMetadata(input){calls.push('metadata');assert(frozen(input));return input},parseState(input,context){calls.push('state:'+context.id);assert(frozen(input));assert(frozen(context));assert.throws(()=>{input.nested[0].x='mutated'},TypeError);return input},validateIndex(index){calls.push('validate');assert(frozen(index))},read:async()=>{throw Error('unused')},readRevision:async()=>{throw Error('unused')}};
 const entries=Object.fromEntries(['__proto__','constructor','ok'].map(id=>[id,{title:id,nested:[Object.fromEntries([['x','original'],['constructor','own'],['__proto__','own-special']])]}]));
 const index={schemaVersion:4,definitionVersion:1,namespace:'probe',metadata:{nested:[{a:1}]},sourceRevision:{metadata:'r',entries:Object.fromEntries(Object.keys(entries).map(id=>[id,'r']))},entries};
 const text=JSON.stringify(index);const ok=parseStateIndex({text,sourcePath:'probe.json',definition});assert.equal(ok.status,'ok');assert(frozen(ok.value));assert.equal(ok.value.entries.__proto__.title,'__proto__');assert.equal(ok.value.entries.constructor.title,'constructor');
 const env=parseStateIndexEnvelope({text,sourcePath:'probe.json',expectation:{namespace:'probe',definitionVersion:1}});assert.equal(env.status,'ok');assert(frozen(env.value));
 const bad=[];for(const change of [v=>{v.schemaVersion=3},v=>{v.entries.ok.nested=[null];v.entries.ok.title=Infinity},v=>{v.sourceRevision.entries.extra='r'},v=>{v.entries.ok=null},v=>{v.metadata=3},v=>{v.entries[' bad ']=v.entries.ok}]){const v=JSON.parse(text);change(v);const r=parseStateIndex({text:JSON.stringify(v),sourcePath:'probe.json',definition});assert.equal(r.status,'error');bad.push(r.diagnostics)}
 const shared={title:'shared',nested:[{x:'external'}]};const sharedMeta={nested:[{x:'external-meta'}]};const sharing={...definition,parseMetadata:()=>sharedMeta,parseState:()=>shared};const separated=parseStateIndex({text,sourcePath:'probe.json',definition:sharing});assert.equal(separated.status,'ok');assert(!Object.isFrozen(shared));assert(!Object.isFrozen(sharedMeta));shared.nested[0].x='later';sharedMeta.nested[0].x='later-meta';assert.equal(separated.value.entries.ok.nested[0].x,'external');assert.equal(separated.value.metadata.nested[0].x,'external-meta');
 const malformed=parseStateIndex({text:'{',sourcePath:'probe.json',definition});assert.equal(malformed.status,'error');bad.push(malformed.diagnostics);
 // Non-finite JSON numbers from a JSON numeric overflow must still be rejected at the envelope.
 const nonfinite=parseStateIndex({text:text.replace('"x":"original"','"x":1e999'),sourcePath:'probe.json',definition});assert.equal(nonfinite.status,'error');bad.push(nonfinite.diagnostics);
 results.push({variant,calls,serialized:serializeStateIndex(ok.value,definition),bad});
}
assert.deepEqual({...results[0],variant:undefined},{...results[1],variant:undefined});console.log(JSON.stringify({equal:true,checks:['nested frozen callback inputs','metadata/context/index recursively frozen','prototype-like own record keys','array/object preservation','external parser return ownership isolation','schema/version/member/value/JSON errors','numeric overflow rejection'],...{results}},null,2));

`````

## `run.py`
源文件 6417 字节，SHA-256 `88bf733bc0d9bdae4fba978cc0ad7a5c1fcee425ba5e2900e38bf845d77a5a32`。 下方为完整内容。
`````python
"""Serial 3-pair alternating isolated CLI experiment; no performance profiler in normal runs."""
from pathlib import Path
import os,json,subprocess,time,signal,sys,hashlib,statistics
from prepare import restore,R,Z,U
from oracle import capture,summary,delta,collection,index_name,verify_index,pending_index,git,stable,sha
os.environ.update(GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null',TZ='UTC',LC_ALL='C.UTF-8')
for key in ['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','NODE_COMPILE_CACHE']:os.environ.pop(key,None)
def cli(v,d):return R/v/'skills'/('decision-records' if d=='decision' else 'investigation-report')/'scripts'/('decision-records.ts' if d=='decision' else 'check-investigations.ts')
def host_activity():
 rows=[]
 raw=subprocess.check_output(['ps','-eo','pid,ppid,comm,pcpu,etime,args','--sort=-pcpu']).decode()
 for line in raw.splitlines()[1:]:
  a=line.split(None,5)
  if len(a)<6 or a[2] not in ['node','bun']:continue
  rows.append({'pid':int(a[0]),'ppid':int(a[1]),'command':a[2],'lifetimeCpuPercent':float(a[3]),'elapsed':a[4],'workload':'external-profile' if '/profile-sample.mjs' in a[5] or '/profile-runner.mjs' in a[5] else 'other-node'})
 return {'nodeBunProcesses':rows,'cgroupCpuStat':dict(line.split() for line in Path('/sys/fs/cgroup/cpu.stat').read_text().splitlines()),'cgroupMemoryCurrent':int(Path('/sys/fs/cgroup/memory.current').read_text())}
def measure(argv,cwd,out,env=None):
 assert not out.with_suffix('.stdout').exists()
 with out.with_suffix('.stdout').open('wb') as stdout,out.with_suffix('.stderr').open('wb') as stderr:
  start=time.monotonic();p=subprocess.Popen(argv,cwd=cwd,stdout=stdout,stderr=stderr,env=env,start_new_session=True)
  def expired(*_):os.killpg(p.pid,signal.SIGKILL)
  old=signal.signal(signal.SIGALRM,expired);signal.alarm(600)
  try:_,status,usage=os.wait4(p.pid,0)
  finally:signal.alarm(0);signal.signal(signal.SIGALRM,old)
  p.returncode=os.waitstatus_to_exitcode(status)
 return {'wallSeconds':time.monotonic()-start,'cpuSeconds':usage.ru_utime+usage.ru_stime,'userSeconds':usage.ru_utime,'systemSeconds':usage.ru_stime,'maxRssKiB':usage.ru_maxrss,'exitCode':p.returncode}
def effect(root,d,scenario,before,after):
 idxpath=collection(d)+'/'+index_name(d);wd=delta(before['files'],after['files']);pd=delta(before['pending'],after['pending']);assert before['head']==after['head'];assert not git(root,'remote').strip()
 if scenario=='sync-selected':
  assert wd==[idxpath],wd;assert not pd;proof=verify_index(root,d,after)
  # Only selected projection/revision changes; byte-for-byte untouched member bodies.
  expected=json.loads(json.dumps(before['index']));expected['entries'][Z]=after['index']['entries'][Z];expected['sourceRevision']['entries'][Z]=after['index']['sourceRevision']['entries'][Z];assert after['index']==expected
 else:
  assert not wd;assert pd==[idxpath],pd
  old=pending_index(root,d,before);new=pending_index(root,d,after);expected=json.loads(json.dumps(old));expected['entries'][Z]=before['index']['entries'][Z];expected['sourceRevision']['entries'][Z]=before['index']['sourceRevision']['entries'][Z];assert new==expected;assert new['entries'][U]['title']=='Pending unrelated title retained';proof={'pendingIndexComposition':'passed','scopeOutsideIdentityProtection':'passed'}
  for p in before['pending']:
   if p!=idxpath:assert before['pending'][p]==after['pending'][p]
 return {'worktreeChangedPaths':wd,'pendingChangedPaths':pd,'before':summary(before),'after':summary(after),'indexByteSha256':sha(after['raws'][idxpath]),'pendingIndexByteSha256':sha(git(root,'cat-file','blob',after['pending'][idxpath]['oid'])),'verification':proof}
def runone(v,d,scenario,i,probe=False):
 root=restore(d,scenario);before=capture(root,d);label=f'{d}-{scenario}-{i}-{v}'+('-probe' if probe else '');out=R/'runs'/label;out.parent.mkdir(exist_ok=True)
 args=['sync-index','--select',Z] if scenario=='sync-selected' else ['stage',Z,'--scope','index']
 argv=['node'];env=dict(os.environ)
 if os.environ.get('INDEX_COST_CLOSURE'):
  env['INDEX_COST_CLOSURE']=str(R/'runs'/('closure-'+label+'.jsonl'));argv+=['--import',str(R/'methods/closure.mjs')]
 if probe:
  config={'outputDir':str(out),'collectionRoot':str(root/collection(d)),'indexFile':str(root/collection(d)/index_name(d))};out.mkdir();conf=out/'config.json';conf.write_text(json.dumps(config));env['RECORD_BENCH_PROBE_CONFIG']=str(conf);env['INDEX_COST_EVENTS']=str(out/'stages.jsonl');argv+=['--import',str(R/'methods/preload.mjs')]
 argv +=[str(cli(v,d)),*args]
 hostBefore=host_activity();metrics=measure(argv,root,out,env);hostAfter=host_activity();after=capture(root,d)
 row={'variant':v,'domain':d,'scenario':scenario,'pair':i,'probe':probe,'argv':argv,'metrics':metrics,'hostBefore':hostBefore,'hostAfter':hostAfter,'stdoutBytes':out.with_suffix('.stdout').stat().st_size,'stderrBytes':out.with_suffix('.stderr').stat().st_size,'stdoutSha256':sha(out.with_suffix('.stdout').read_bytes()),'stderrSha256':sha(out.with_suffix('.stderr').read_bytes())}
 try:
  if metrics['exitCode']!=0:raise RuntimeError(('nonzero CLI',metrics['exitCode']))
  row['effect']=effect(root,d,scenario,before,after)
 except Exception as e:
  row['verificationError']=repr(e);row['failedAfter']=summary(after)
  with (R/'samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
  raise
 with (R/'samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
 print(label,round(metrics['wallSeconds'],3),flush=True);return row
if __name__=='__main__':
 mode=sys.argv[1] if len(sys.argv)>1 else 'normal';rows=[]
 if mode=='normal':
  for i in range(3):
   for d,s in [('decision','sync-selected'),('investigation','sync-selected'),('decision','stage-index'),('investigation','stage-index')]:
    pair=[]
    for v in (['before','after'] if i%2==0 else ['after','before']):pair.append(runone(v,d,s,i))
    a,b=pair;assert a['stdoutSha256']==b['stdoutSha256'] and a['stderrSha256']==b['stderrSha256'];assert a['effect']==b['effect'];rows+=pair
 elif mode=='smoke':
  for d,s in [('decision','sync-selected'),('investigation','sync-selected'),('decision','stage-index'),('investigation','stage-index')]:runone('before',d,s,99)
 elif mode=='probe':
  for d,s in [('decision','sync-selected'),('investigation','sync-selected'),('decision','stage-index'),('investigation','stage-index')]:
   for v in ['probe-before','probe-after']:runone(v,d,s,3,True)

`````

## `instrument.py`
源文件 3046 字节，SHA-256 `81e83c92da9ff7d7640d201d4e2942b3a07b70901e84fbda15bee12eaf408cbd`。 下方为完整内容。
`````python
"""Create distinct probe copies; source wrappers are never used by normal measurements."""
from pathlib import Path
import shutil,sys
R=Path(__file__).resolve().parents[1]
spec=[('tools/index-runtime/src/snapshot-parser.ts','parseStateIndex',False),('tools/index-runtime/src/snapshot-parser.ts','parseStateIndexEnvelope',False),('tools/index-runtime/src/snapshot-parser.ts','serializeStateIndex',False),('tools/index-runtime/src/validation.ts','validateStateIndexValue',False),('tools/index-runtime/src/projection.ts','normalizeStateIndex',False),('tools/index-runtime/src/snapshot-builder.ts','buildStateIndexFromSnapshot',False),('tools/index-runtime/src/canonicalization.ts','canonicalizeStateIndex',False),('tools/investigation-report/src/relation-validation.ts','validateInvestigationRelationGraph',False),('tools/decision-records/src/relation-graph.ts','decisionRelationConsistencyIssues',False),('tools/shared/src/version-control/git-pending-snapshot-content.ts','selectedPendingBlobs',True),('tools/index-runtime/src/record-staging.ts','prepareRecordStage',True),('tools/shared/src/version-control/pending-snapshot.ts','preparePendingPatch',True),('tools/shared/src/version-control/pending-snapshot.ts','writePendingPatch',True)]
helper='''\nimport {appendFileSync as __costAppend} from 'node:fs';
function __cost(name, fn, args, asyncCall) {
 const t=performance.now();const cpu=process.cpuUsage();
 const done=()=>{const c=process.cpuUsage(cpu);__costAppend(process.env.INDEX_COST_EVENTS,JSON.stringify({name,wallMs:performance.now()-t,cpuMs:(c.user+c.system)/1000,args:args.map(v=>typeof v==='string'?v:undefined),stack:new Error().stack?.split('\\n').slice(2,7)})+'\\n')};
 if(asyncCall)return (async()=>{try{return await fn(...args)}finally{done()}})();
 try{return fn(...args)}finally{done()}
}
'''
for v in ['before','after']:
 target=R/('probe-'+v);target.mkdir()
 shutil.copytree(R/v/'skills',target/'skills',symlinks=True);(target/'node_modules').symlink_to('../before/node_modules')
 edits={}
 for rel,name,asyncCall in spec:
  files=list((target/'skills').glob('*/scripts/runtime/'+rel))
  for p in files:
   s=edits.get(p,p.read_text());prefix=('async ' if asyncCall else '')+'function '+name
   if prefix not in s:
    print('SKIP missing',rel,name);continue
   s=s.replace(prefix,('async ' if asyncCall else '')+'function __original_'+name,1)
   # Keep export on original but route all imported and internal name consumers through this wrapper.
   s+=f'\nexport function {name}(...args) {{ return __cost("{Path(rel).name}:{name}", __original_{name}, args, {str(asyncCall).lower()}); }}\n'
   edits[p]=s
 for p,s in edits.items():
  if p.name=='snapshot-parser.ts':
   s=s.replace('value = JSON.parse(options.text);','value = __cost("json.decode", () => JSON.parse(options.text), [], false);')
   for call in ['cloneAndFreezeTypedJsonObject(validated.index, false)','freezeOwnedEnvelope(validated.index)']:
    s=s.replace('value: '+call,'value: __cost("envelope.seal", () => '+call+', [], false)')
  p.write_text(s+helper)

`````

## `preload.mjs`
源文件 15044 字节，SHA-256 `8bcc71df775e305a5ad3bbd7be485cb8d81b31fafb8429cfa5fe04f9774789c1`。 下方为完整内容。
`````javascript
/**
 * One-run workload observer. Only probe invocations import this module.
 * @typedef {{file:string,sha256:string,needle:string,insert:string}} SourceHook
 * @typedef {{outputDir:string,collectionRoot:string,indexFile:string,candidatePaths?:string[],resourceRoots?:string[],gitObjectRoles?:Record<string,string[]>,hooks?:SourceHook[]}} ProbeConfig
 * @typedef {{path:string,category:string,direction:'read'|'write',method:string,calls:number,bytes:number}} IoObservation
 * Config is a JSON boundary validated below. Operation state belongs to this thread;
 * JSONL append is the authoritative cross-thread handoff, not a shared mutable map.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import cp from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { threadId, isMainThread } from 'node:worker_threads';
import { AsyncLocalStorage } from 'node:async_hooks';

const rawRead = fs.readFileSync.bind(fs);
const rawWrite = fs.writeFileSync.bind(fs);
const rawAppend = fs.appendFileSync.bind(fs);
const configPath = process.env.RECORD_BENCH_PROBE_CONFIG;
if (!configPath) throw new Error('RECORD_BENCH_PROBE_CONFIG is required for probe');
const config = JSON.parse(rawRead(configPath, 'utf8'));
if (!config || typeof config !== 'object' || typeof config.outputDir !== 'string' || typeof config.collectionRoot !== 'string' || typeof config.indexFile !== 'string') {
  throw new Error('Invalid probe config: outputDir/collectionRoot/indexFile required');
}
for (const key of ['candidatePaths', 'resourceRoots', 'hooks']) {
  if (config[key] !== undefined && !Array.isArray(config[key])) throw new Error('Invalid array '+key);
}
for(const key of ['candidatePaths','resourceRoots']) {
  if((config[key]??[]).some(p=>typeof p!=='string'||!path.isAbsolute(p)))throw new Error('Invalid absolute paths '+key);
}
if(config.gitObjectRoles!==undefined && (!config.gitObjectRoles||typeof config.gitObjectRoles!=='object'||Object.values(config.gitObjectRoles).some(oids=>!Array.isArray(oids)||oids.some(oid=>typeof oid!=='string'||!/^[0-9a-f]{40,64}$/u.test(oid)))))throw new Error('Invalid Git object role map');
const collectionRoot = path.resolve(config.collectionRoot);
const indexFile = path.resolve(config.indexFile);
const observedRoles = new Map();
const candidates = new Set((config.candidatePaths ?? []).map(p => path.resolve(p)));
const resources = (config.resourceRoots ?? []).map(p => path.resolve(p));
const state = {schemaVersion:1, pid:process.pid,threadId,isMainThread,io:[],git:[],counts:{},transforms:[],unknown:[],boundaries:[
  'Logical Node FS API completed bytes; nested readFile/read and writeFile/write deduplicated.',
  'Successful readFile string byte length uses returned text encoding; all benchmark source reads use Buffer or UTF-8.',
  'Failed high-level IO can transfer partial bytes without reporting them; marked unknown.',
  'Git subprocess internal filesystem IO is not observed. Git stdout protocol bytes are observed.',
  'Kernel cache/storage physical reads, mmap, native-addon direct IO, and Node module-loader internals are outside this observer.'
]};
const eventPath=path.join(config.outputDir,`probe-${process.pid}-${threadId}.events.jsonl`);
let observerIO=false;
function event(type,value) { observerIO=true; try { rawAppend(eventPath,JSON.stringify({type,value})+'\n'); } finally { observerIO=false; } }
event('start',{schemaVersion:1,pid:process.pid,threadId,isMainThread});
const fds = new Map();
const io = new Map();
let syncDepth = 0;
let gitSequence = 0;
function textPath(value) {
  if (typeof value === 'number') return fds.get(value) ?? `unknown-fd:${value}`;
  if (value instanceof URL) return fileURLToPath(value);
  if (typeof value === 'string' || Buffer.isBuffer(value)) return path.resolve(String(value));
  return 'unknown-path';
}
function category(p) {
  if (p === indexFile) return 'index';
  if (observedRoles.has(p)) return observedRoles.get(p);
  if (candidates.has(p)) return 'candidate';
  if (resources.some(r => p === r || p.startsWith(r+path.sep))) return 'resource';
  if (p.startsWith(collectionRoot+path.sep) && p.endsWith('.md')) return 'formal';
  if (p === collectionRoot || p.startsWith(collectionRoot+path.sep)) return 'collection-other';
  if (p.startsWith('unknown-')) return 'unknown';
  return 'other';
}
function length(data, encoding='utf8') {
  if (typeof data === 'string') return Buffer.byteLength(data, typeof encoding === 'string' ? encoding : 'utf8');
  if (ArrayBuffer.isView(data)) return data.byteLength;
  return null;
}
function record(p, direction, method, bytes, content) {
  if(observerIO)return;
  if(p.startsWith(collectionRoot+path.sep) && p.endsWith('.md') && (typeof content==='string'||Buffer.isBuffer(content))) {
    const header=(typeof content==='string'?content:content.toString('utf8',0,Math.min(content.length,4096)));
    if(/^\ufeff?---\r?\n/u.test(header)) {
      const status=/^status:\s*["']?(candidate|active|archived)["']?\s*$/mu.exec(header);
      if(status)observedRoles.set(p,status[1]==='candidate'?'candidate':'formal');
    }
  }
  if (!Number.isSafeInteger(bytes) || bytes < 0) { state.unknown.push({p,direction,method,reason:'unreported-byte-count'}); return; }
  const key=JSON.stringify([p,direction,method]);
  const prior=io.get(key) ?? {path:p,category:category(p),direction,method,calls:0,bytes:0};
  prior.calls++; prior.bytes+=bytes; io.set(key,prior); event('io',{path:p,category:category(p),direction,method,calls:1,bytes});
}
function failed(p,direction,method,error) {
  if(observerIO)return;
  state.unknown.push({path:p,direction,method,reason:'failed-operation-partial-bytes-unknown',error:error instanceof Error ? error.message : String(error)});
}
globalThis.__recordProbeCount = (name,amount=1) => {
  if (typeof name !== 'string' || !Number.isFinite(amount)) throw new Error('Invalid probe count');
  state.counts[name] = (state.counts[name] ?? 0)+amount; event('count',{name,amount});
};

// Synchronous APIs: depth suppression prevents readFileSync(fd)->readSync double count.
const rawOpenSync=fs.openSync; const rawCloseSync=fs.closeSync;
fs.openSync=function(...args) { const fd=Reflect.apply(rawOpenSync,this,args); fds.set(fd,textPath(args[0])); return fd; };
fs.closeSync=function(fd) { try { return rawCloseSync(fd); } finally { fds.delete(fd); } };
for (const [name,direction] of [['readFileSync','read'],['writeFileSync','write'],['appendFileSync','write'],['readSync','read'],['writeSync','write']]) {
  const original=fs[name];
  fs[name]=function(...args) {
    const nested=syncDepth>0; const p=textPath(args[0]); syncDepth++;
    try {
      const result=Reflect.apply(original,this,args);
      if (!nested) {
        const bytes=name==='readFileSync' ? length(result,args[1]?.encoding ?? args[1]) : name==='readSync'||name==='writeSync' ? result : length(args[1],args[2]?.encoding ?? args[2]);
        record(p,direction,name,bytes,name==='readFileSync'?result:direction==='write'?args[1]:undefined);
      }
      return result;
    } catch(error) { if (!nested) failed(p,direction,name,error); throw error; }
    finally { syncDepth--; }
  };
}

// Promise path APIs are high-level boundaries and do not call the exported open wrapper.
for (const [name,direction] of [['readFile','read'],['writeFile','write'],['appendFile','write']]) {
  const original=fsp[name];
  fsp[name]=async function(...args) {
    const p=textPath(args[0]);
    try { const result=await Reflect.apply(original,this,args); record(p,direction,name,name==='readFile'?length(result,args[1]?.encoding ?? args[1]):length(args[1],args[2]?.encoding ?? args[2]),name==='readFile'?result:args[1]); return result; }
    catch(error) { failed(p,direction,name,error); throw error; }
  };
}
const handleContext=new AsyncLocalStorage();
const rawOpen=fsp.open;
fsp.open=async function(...args) {
  const p=textPath(args[0]); const handle=await Reflect.apply(rawOpen,this,args); fds.set(handle.fd,p);
  for (const [name,direction] of [['readFile','read'],['writeFile','write'],['appendFile','write'],['read','read'],['write','write'],['readv','read'],['writev','write']]) {
    const original=handle[name];
    handle[name]=async function(...values) {
      const ancestors=handleContext.getStore() ?? new Set();
      const nested=ancestors.has(handle);
      const context=new Set([...ancestors,handle]);
      try {
        const result=await handleContext.run(context,()=>Reflect.apply(original,this,values));
        if (!nested) {
          const bytes=['read','readv'].includes(name)?result.bytesRead:['write','writev'].includes(name)?result.bytesWritten:name==='readFile'?length(result,values[0]?.encoding ?? values[0]):length(values[0],values[1]?.encoding ?? values[1]);
          record(p,direction,'FileHandle.'+name,bytes,name==='readFile'?result:name==='read'?result.buffer:direction==='write'?values[0]:undefined);
        }
        return result;
      } catch(error) { if (!nested) failed(p,direction,'FileHandle.'+name,error); throw error; }
    };
  }
  const close=handle.close.bind(handle); const fd=handle.fd;
  handle.close=async function() { try { return await close(); } finally { fds.delete(fd); } };
  return handle;
};

// Per-call async context suppresses internal callback write/read without suppressing concurrent calls.
const callbackContext=new AsyncLocalStorage();
// Callback APIs used by consumers are observed without replacing their callback semantics.
const rawOpenCallback=fs.open;
fs.open=function(...args) {
  const callback=args.at(-1); const p=textPath(args[0]);
  if (typeof callback!=='function') return Reflect.apply(rawOpenCallback,this,args);
  args[args.length-1]=function(error,fd) { if (!error) fds.set(fd,p); return callback(error,fd); };
  return Reflect.apply(rawOpenCallback,this,args);
};
for (const [name,direction] of [['readFile','read'],['writeFile','write'],['appendFile','write'],['read','read'],['write','write']]) {
  const original=fs[name];
  fs[name]=function(...args) {
    const callback=args.at(-1); const p=textPath(args[0]);
    if (typeof callback!=='function' || callbackContext.getStore()===true) return Reflect.apply(original,this,args);
    args[args.length-1]=function(error,result,...rest) {
      if (error) failed(p,direction,name,error);
      else record(p,direction,name,name==='readFile'?length(result,args[1]?.encoding ?? args[1]):name==='read'||name==='write'?result:length(args[1],args[2]?.encoding ?? args[2]),name==='readFile'?result:direction==='write'?args[1]:undefined);
      return callbackContext.run(false,()=>callback(error,result,...rest));
    };
    return callbackContext.run(true,()=>Reflect.apply(original,this,args));
  };
}

function parseBatch(buffer) {
  const blobs=[]; let offset=0; let headerBytes=0; let payloadBytes=0;
  while(offset<buffer.length) {
    const end=buffer.indexOf(10,offset); if(end<0) throw new Error('truncated batch header');
    const header=buffer.subarray(offset,end).toString('ascii'); const match=/^([0-9a-f]+) blob (\d+)$/.exec(header);
    if(!match) throw new Error('unexpected batch header: '+header);
    const size=Number(match[2]); headerBytes+=end+1-offset; offset=end+1;
    if(!Number.isSafeInteger(size)||offset+size>=buffer.length||buffer[offset+size]!==10) throw new Error('truncated batch payload');
    const memberships=Object.entries(config.gitObjectRoles ?? {}).filter(([,oids])=>oids.includes(match[1])).map(([role])=>role);
    blobs.push({oid:match[1],bytes:size,roles:memberships.length?memberships:['unknown']}); payloadBytes+=size; offset+=size+1;
  }
  return {blobs,headerBytes,payloadBytes,trailerBytes:blobs.length};
}
function observeChild(child,command,args) {
  if (path.basename(String(command))!=='git') return child;
  const entry={sequence:gitSequence++,command:String(command),argv:args,stdoutBytes:0,stderrBytes:0,requests:[],batch:null,exitCode:null};
  state.git.push(entry); const stdout=[];
  if(child.stdout) child.stdout.on('data',chunk => { const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk); entry.stdoutBytes+=data.length; if(args.includes('cat-file')&&args.includes('--batch')) stdout.push(data); });
  if(child.stderr) child.stderr.on('data',chunk => {entry.stderrBytes+=Buffer.byteLength(chunk);});
  if(child.stdin) {
    const write=child.stdin.write.bind(child.stdin); const end=child.stdin.end.bind(child.stdin); let input='';
    child.stdin.write=function(...values) { if(typeof values[0]==='string'||Buffer.isBuffer(values[0])) input+=String(values[0]); return Reflect.apply(write,this,values); };
    child.stdin.end=function(...values) { if(typeof values[0]==='string'||Buffer.isBuffer(values[0])) input+=String(values[0]); entry.requests=input.split('\n').filter(Boolean); return Reflect.apply(end,this,values); };
  }
  child.once('close',code => { entry.exitCode=code; if(stdout.length) { try {entry.batch=parseBatch(Buffer.concat(stdout));} catch(error) {entry.batch={error:String(error),payloadBytes:null};state.unknown.push({reason:'git-batch-frame-failure',sequence:entry.sequence});} } event('git',entry); });
  return child;
}
for (const name of ['spawn','execFile']) {
  const original=cp[name];
  cp[name]=function(...args) { return observeChild(Reflect.apply(original,this,args),args[0],Array.isArray(args[1])?args[1]:[]); };
}
// Mutation of built-ins must precede loading production ESM named imports, also in workers.
syncBuiltinESMExports();

const specs=config.hooks ?? [];
for (const spec of specs) {
  if(!spec||typeof spec.file!=='string'||typeof spec.sha256!=='string'||typeof spec.needle!=='string'||typeof spec.insert!=='string') throw new Error('Invalid source hook spec');
}
if(specs.length) registerHooks({load(url,context,nextLoad) {
  const result=nextLoad(url,context); const file=url.startsWith('file:')?fileURLToPath(url):null;
  const matches=specs.filter(spec=>path.resolve(spec.file)===file);
  if(!matches.length) return result;
  let source=typeof result.source==='string'?result.source:Buffer.from(result.source).toString('utf8');
  const originalSha=createHash('sha256').update(source).digest('hex');
  for(const spec of matches) {
    if(spec.sha256!==originalSha) throw new Error('Probe source fingerprint mismatch: '+file);
    if(source.split(spec.needle).length!==2) throw new Error('Probe hook needle not unique: '+file);
    source=source.replace(spec.needle,spec.needle+spec.insert);
    state.transforms.push({file,originalSha,needle:spec.needle,insert:spec.insert});
  }
  state.transforms.push({file,transformedSha:createHash('sha256').update(source).digest('hex')});
  return {...result,source};
}});

process.on('exit',()=> {
  state.io=[...io.values()];
  event('end',{unknown:state.unknown,boundaries:state.boundaries,transforms:state.transforms});
  observerIO=true;
  rawWrite(path.join(config.outputDir,`probe-${process.pid}-${threadId}.json`),JSON.stringify(state,null,2)+'\n');
});

`````

## `oracle.py`
源文件 11678 字节，SHA-256 `1f220c71d3c4c72685e0ad2b2b000220334cda2ee02762f66a0e2d29615d05c7`。 下方为节选：省去本轮未调用的历史 verify_effect 及后续函数。
`````python
"""Independent YAML, content-fingerprint, complete W/P oracle; no product imports."""
from pathlib import Path
import hashlib,json,os,re,subprocess,yaml
class Loader(yaml.CSafeLoader):pass
Loader.yaml_implicit_resolvers={k:[(t,p) for t,p in v if t!='tag:yaml.org,2002:timestamp'] for k,v in yaml.CSafeLoader.yaml_implicit_resolvers.items()}
PARSED={};OBJECTS={}
def sha(data):return hashlib.sha256(data).hexdigest()
def stable(value):return sha(json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode())
def git(root,*args,data=None):
 p=subprocess.run(['git','-C',str(root),*args],input=data,capture_output=True)
 if p.returncode:raise RuntimeError((args,p.stderr.decode()))
 return p.stdout
def collection(domain):return 'docs/decisions' if domain=='decision' else 'docs/investigations'
def index_name(domain):return 'decision-index.json' if domain=='decision' else 'investigation-index.json'
def parse(raw):
 key=sha(raw)
 if key not in PARSED:
  text=raw.decode().removeprefix('\ufeff').replace('\r\n','\n').replace('\r','\n')
  assert text.startswith('---\n')
  head,sep,body=text[4:].partition('\n---\n');assert sep
  meta=yaml.load(head,Loader=Loader);assert isinstance(meta,dict) and isinstance(meta['id'],str)
  PARSED[key]=(meta,body)
 return PARSED[key]
def fingerprint(label,*values):
 h=hashlib.sha256((label+'\0').encode())
 for value in values:
  data=value.encode();h.update(str(len(data)).encode()+b':'+data+b'\0')
 return 'sha256:'+h.hexdigest()
def projection(domain,source,raw):
 m,b=parse(raw);identity=m['id']
 fields=('title','status','alignment','createdAt','purpose','background','decision','tags','relations') if domain=='decision' else ('title','formedAt','question','tags','relations')
 entry={k:m[k] for k in fields}
 entry.update(name=identity[7:],sourcePath=source)
 if domain=='investigation':
  entry['resourceIds']=sorted(set(re.findall(r'\]\(\./_resources/([^\s)]+)\)',raw.decode())))
 text=raw.decode().replace('\r\n','\n')
 if domain=='investigation':text=text.replace('\r','\n')
 return identity,entry,fingerprint(('decision' if domain=='decision' else 'investigation')+'-index-entry-v2',identity,source,text)
def capture(root,domain):
 c=collection(domain); files={};docs={};raws={}
 for directory,names,filenames in os.walk(root):
  names[:]=[n for n in names if n!='.git']
  for name in filenames:
   p=Path(directory)/name;assert not p.is_symlink()
   rel=p.relative_to(root).as_posix();data=p.read_bytes();raws[rel]=data
   files[rel]={'sha256':sha(data),'bytes':len(data),'mode':p.stat().st_mode&0o777}
   if rel.startswith(c+'/') and (name.endswith('.md') or name.startswith('_candidate.')):
    m,b=parse(data);i=m['id'];assert i not in docs
    docs[i]={'path':rel[len(c)+1:],'metadata':m,'body':b,'sha256':sha(data)}
 idxraw=raws.get(c+'/'+index_name(domain))
 try:idx=json.loads(idxraw) if idxraw else None
 except ValueError:idx='invalid'
 pending={}
 for row in git(root,'ls-files','--stage','-z').split(b'\0'):
  if not row:continue
  meta,name=row.split(b'\t',1);mode,oid,stage=meta.decode().split();assert stage=='0'
  pending[name.decode()]={'mode':mode,'oid':oid}
 oids=sorted(set(v['oid'] for v in pending.values())-set(OBJECTS))
 if oids:
  batch=git(root,'cat-file','--batch',data=('\n'.join(oids)+'\n').encode());pos=0
  for oid in oids:
   end=batch.index(b'\n',pos);parts=batch[pos:end].decode().split();assert parts[:2]==[oid,'blob']
   n=int(parts[2]);payload=batch[end+1:end+1+n];assert len(payload)==n and batch[end+1+n:end+2+n]==b'\n'
   OBJECTS[oid]={'sha256':sha(payload),'bytes':n};pos=end+2+n
  assert pos==len(batch)
 for value in pending.values():value.update(OBJECTS[value['oid']])
 return {'files':files,'docs':docs,'index':idx,'pending':pending,'head':git(root,'rev-parse','HEAD').decode().strip(),'raws':raws}
def summary(s):
 return {'files':len(s['files']),'worktreeSha256':stable(s['files']),'pendingPaths':len(s['pending']),'pendingSha256':stable(s['pending']),'head':s['head'],'indexSha256':stable(s['index'])}
def delta(left,right):return sorted(k for k in left.keys()|right.keys() if left.get(k)!=right.get(k))
def formal(domain,s):
 return {i:d for i,d in s['docs'].items() if (d['metadata']['status']!='candidate' if domain=='decision' else not d['path'].startswith('_candidate.'))}
def verify_index(root,domain,s):
 fs=formal(domain,s);idx=s['index'];assert isinstance(idx,dict)
 assert idx['schemaVersion']==4 and idx['definitionVersion']==11
 assert idx['namespace']==('decisions' if domain=='decision' else 'investigations')
 assert idx['metadata']=={} and set(idx['entries'])==set(fs)
 label='decision-index-metadata-v2' if domain=='decision' else 'investigation-index-metadata-v4'
 assert idx['sourceRevision']['metadata']==fingerprint(label,'{}')
 assert set(idx['sourceRevision']['entries'])==set(fs)
 for i,d in fs.items():
  identity,entry,rev=projection(domain,d['path'],s['raws'][collection(domain)+'/'+d['path']])
  assert idx['entries'][i]==entry,('projection',i,idx['entries'][i],entry)
  assert idx['sourceRevision']['entries'][i]==rev,('revision',i)
  for rel in entry['relations']:assert rel['target'] in fs,('dangling',i,rel)
  if domain=='decision':assert d['path'].startswith('archive/')==(d['metadata']['status']=='archived')
  else:
   for resource in entry['resourceIds']:assert collection(domain)+'/_resources/'+resource in s['files']
 return {'formal':len(fs),'relations':sum(len(d['metadata']['relations']) for d in fs.values()),'indexAndCompleteSourceRevision':'passed','resourceReferences':'passed' if domain=='investigation' else 'not-applicable'}
def pending_index(root,domain,s):
 p=collection(domain)+'/'+index_name(domain)
 return json.loads(git(root,'cat-file','blob',s['pending'][p]['oid']))

`````

## `summarize.py`
源文件 3751 字节，SHA-256 `7016693fc74156a5a54a781aea729bad0e1e496639eee95bcb1197de6485a14a`。 下方为完整内容。
`````python
from pathlib import Path
import json,statistics,collections,datetime
from oracle import sha
R=Path(__file__).resolve().parents[1];rows=[json.loads(l) for l in (R/'samples.jsonl').read_text().splitlines()];groups={};workloads=[]
for d,s in [('decision','sync-selected'),('investigation','sync-selected'),('decision','stage-index'),('investigation','stage-index')]:
 normal=[r for r in rows if r['domain']==d and r['scenario']==s and r['pair']<3]
 out={'normalSamples':len(normal),'variants':{},'pairs':[]}
 for v in ['before','after']:
  vr=[r for r in normal if r['variant']==v];out['variants'][v]={k:{'min':min(r['metrics'][k] for r in vr),'median':statistics.median(r['metrics'][k] for r in vr),'max':max(r['metrics'][k] for r in vr)} for k in ['wallSeconds','cpuSeconds','maxRssKiB']}
 for i in range(3):
  a=next(r for r in normal if r['variant']=='before' and r['pair']==i);b=next(r for r in normal if r['variant']=='after' and r['pair']==i);assert a['effect']==b['effect'] and a['stdoutSha256']==b['stdoutSha256'] and a['stderrSha256']==b['stderrSha256'];out['pairs'].append({'pair':i,'wallAfterVsBefore':b['metrics']['wallSeconds']/a['metrics']['wallSeconds'],'cpuAfterVsBefore':b['metrics']['cpuSeconds']/a['metrics']['cpuSeconds'],'rssAfterVsBefore':b['metrics']['maxRssKiB']/a['metrics']['maxRssKiB'],'outputAndEffectsEqual':True})
 out['medianRatios']={k:out['variants']['after'][k]['median']/out['variants']['before'][k]['median'] for k in ['wallSeconds','cpuSeconds','maxRssKiB']};groups[d+'/'+s]=out
 for v in ['probe-before','probe-after']:
  row=next(r for r in rows if r['domain']==d and r['scenario']==s and r['variant']==v);directory=R/'runs'/f'{d}-{s}-3-{v}-probe';events=[json.loads(l) for f in directory.glob('*.events.jsonl') for l in f.read_text().splitlines()];stages=[json.loads(l) for l in (directory/'stages.jsonl').read_text().splitlines()]
  io={};stage={};git=[]
  for e in events:
   if e['type']=='io':
    x=e['value'];g=io.setdefault(x['category']+'/'+x['direction'],{'calls':0,'bytes':0,'paths':set()});g['calls']+=x['calls'];g['bytes']+=x['bytes'];g['paths'].add(x['path'])
   if e['type']=='git' and e['value'].get('batch'):git.append(e['value'])
  for g in io.values():g['uniquePaths']=len(g.pop('paths'))
  for e in stages:
   g=stage.setdefault(e['name'],{'calls':0,'inclusiveWallMs':0,'inclusiveCpuMs':0});g['calls']+=1;g['inclusiveWallMs']+=e['wallMs'];g['inclusiveCpuMs']+=e['cpuMs']
  payload=0;blobs=[]
  for batch in git:
   assert not batch['batch'].get('error'),batch
   for b in batch['batch']['blobs']:payload+=b['bytes'];blobs.append({'oid':b['oid'],'bytes':b['bytes']})
  # Normal/probe output and full complete W/P state must remain identical despite altered source paths.
  normalrow=next(r for r in normal if r['variant']==v.removeprefix('probe-'));assert row['effect']==normalrow['effect'] and row['stdoutSha256']==normalrow['stdoutSha256'] and row['stderrSha256']==normalrow['stderrSha256']
  unknown=[u for e in events if e['type']=='end' for u in e['value']['unknown']]
  workloads.append({'domain':d,'scenario':s,'variant':v,'io':io,'physicalGitIndexApi':[e['value'] for e in events if e['type']=='io' and '/.git/' in e['value']['path']],'stages':stage,'git':{'batches':len(git),'payloadBytes':payload,'blobs':blobs},'probeMetrics':row['metrics'],'normalOutputAndEffectsEqual':True,'observerUnknown':unknown})
summary={'normalScenarioCount':4,'normalSampleCount':24,'probeSampleCount':8,'smokeSampleCount':len([r for r in rows if r['pair']>=98]),'failures':[r for r in rows if 'verificationError' in r],'groups':groups}
(R/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');(R/'workloads.json').write_text(json.dumps(workloads,indent=2)+'\n')
print(json.dumps(summary,indent=2))

`````

## `payload-proof.py`
源文件 1735 字节，SHA-256 `2ac31007b65521e7f679ffa6480fc5fe7937bdee6ccd8a5111d1f22f9ac238e4`。 下方为完整内容。
`````python
"""Offline posterior: bind each observed Git OID to fixed input/final index, not a timing rerun."""
from pathlib import Path
import json,hashlib
from prepare import R,U,Z,modify,write_idx
from oracle import git,collection,index_name,sha
workloads=json.loads((R/'workloads.json').read_text());proof=[]
for d in ['decision','investigation']:
 root=R/'work'/d;rel=collection(d)+'/'+index_name(d);head=git(root,'show','HEAD:'+rel);pending=json.loads(head);modify(d,pending,U,'Pending unrelated title retained');prior=(json.dumps(pending,ensure_ascii=False,indent=2,sort_keys=d=='investigation')+'\n').encode();final=git(root,'show',':'+rel)
 def oid(raw):return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
 role={oid(head):'fixed-HEAD-index',oid(prior):'captured-pending-index',oid(final):'published-pending-index'}
 for raw in [head,prior,final]:
  v=json.loads(raw);assert len(v['entries'])==10000 and len(v['sourceRevision']['entries'])==10000
  proof.append({'domain':d,'oid':oid(raw),'role':role[oid(raw)],'bytes':len(raw),'sha256':sha(raw),'namespace':v['namespace'],'entryCount':10000})
 for w in workloads:
  if w['domain']!=d or w['scenario']!='stage-index':continue
  for blob in w['git']['blobs']:
   assert blob['oid'] in role;blob['role']=role[blob['oid']]
   assert blob['bytes']==next(p['bytes'] for p in proof if p['domain']==d and p['oid']==blob['oid'])
  counts={r:sum(b['role']==r for b in w['git']['blobs']) for r in role.values()};assert counts=={'fixed-HEAD-index':1,'captured-pending-index':3,'published-pending-index':1},counts
(R/'payload-proof.json').write_text(json.dumps(proof,indent=2)+'\n');(R/'workloads.json').write_text(json.dumps(workloads,indent=2)+'\n');print(json.dumps(proof))

`````
