# 形成时方法代码

以下为本轮实际使用的方法完整源码；只替换路径为 `$WORK` / `$REPO` / `$EXTERNAL_OPTIONAL`，不是可直接在报告目录运行的产品工具。fixture、依赖和大索引未随附。执行仍须另行授权并准备路径与依赖。`bench.py` 的 startedAt/finishedAt 在后续独立 check 与 IR 短/长正文补充前加入，不改变早期样本计时；早期函数体可由删除这两项元数据赋值准确恢复。`fix-measure.py` 保留 `/usr/bin/time` 缺失后的方法修正，实际全部样本使用 wait4。

## prepare.py

```python
from pathlib import Path
import shutil, subprocess, json, hashlib, os, platform, time
R=Path('$REPO'); D=Path(__file__).resolve().parents[1]
def digest(root):
 h=hashlib.sha256(); n=0; size=0
 for p in sorted(root.rglob('*')):
  if p.is_file():
   b=p.read_bytes(); h.update(str(p.relative_to(root)).encode()+b'\0'+hashlib.sha256(b).digest());n+=1;size+=len(b)
 return dict(sha256=h.hexdigest(),files=n,bytes=size)
base=D/'base';base.mkdir(exist_ok=True)
for x in ['tools','node_modules']:
 shutil.copytree(R/x,base/x,symlinks=True,dirs_exist_ok=True)
for s in ['decision-records','investigation-report']:
 shutil.copytree(R/'skills'/s,base/'skills'/s,symlinks=True,dirs_exist_ok=True)
for x in ['package.json','pnpm-lock.yaml']:shutil.copy2(R/x,base/x)
env=dict(time=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),node=subprocess.check_output(['node','--version'],text=True).strip(),bun=subprocess.check_output(['/home/dev/.local/share/mise/installs/bun/1.4.2/bin/bun','--version'],text=True).strip(),platform=platform.platform(),cpu=Path('/proc/cpuinfo').read_text().split('model name\t: ')[1].split('\n')[0],cpus=os.cpu_count(),affinity=sorted(os.sched_getaffinity(0)),cgroup={x:(Path('/sys/fs/cgroup')/x).read_text() for x in ['cpu.max','memory.max']},fingerprints={x:digest(base/x) for x in ['tools','node_modules','skills/decision-records','skills/investigation-report']})
(D/'environment-start.json').write_text(json.dumps(env,ensure_ascii=False,indent=2))
proto=D/'proto';shutil.copytree(base/'tools',proto/'tools',dirs_exist_ok=True)
for s in ['decision-records','investigation-report']:shutil.copytree(base/'skills'/s,proto/'skills'/s,dirs_exist_ok=True)
(proto/'node_modules').symlink_to(base/'node_modules',target_is_directory=True)
shutil.copy2(base/'package.json',proto/'package.json')
print(json.dumps(env,ensure_ascii=False))

```

## bench.py

```python
from pathlib import Path
import subprocess,json,time,hashlib,os,shutil,sys,signal
D=Path(__file__).resolve().parents[1]
def sha(b):return hashlib.sha256(b).hexdigest()
def body(domain,i,padding=''):
 id=f'261024-record-{i:06d}'
 if domain=='dr':
  return f'''---\ntitle: 记录 {i}\nid: {id}\nstatus: active\nalignment: aligned\ncreatedAt: 2026-10-24T00:00:00Z\npurpose: 检查当前来源。\nbackground: 规模基准。\ndecision: 维持行为。\ntags:\n  - performance\nrelations: []\n---\n\n## 目的\n检查当前来源。\n\n## 背景\n规模基准。\n{padding}\n## 决策\n- 采用: 维持行为。\n'''
 return f'''---\ntitle: "记录 {i}"\nid: "{id}"\nformedAt: "2026-10-24T00:00:00Z"\nquestion: "全量成本是什么？"\ntags:\n  - "performance"\nrelations: []\n---\n\n## 形成时背景\n当前规模基准。\n{padding}\n## 调查目的\n量化成本。\n\n## 调查范围与依据\n当前冻结来源。\n\n## 调查结果与边界\n只适用于合成输入。\n'''
def entry(v,d,source=False):
 s='decision-records' if d=='dr' else 'investigation-report';f='decision-records.ts' if d=='dr' else 'check-investigations.ts'
 return D/v/('tools/'+s+'/src/cli.ts' if source else 'skills/'+s+'/scripts/'+f)
def command(v,d,root,case,probe=False,source=False):
 c=['node'];env=os.environ.copy()
 if probe:c+=['--import',str(D/'methods/loader.mjs')]
 c +=[str(entry(v,d,source)),'--root',str(root),'check' if case=='check' else 'sync-index']
 if case=='preflight':c+=['--preflight']
 return c,env
def tree(root):
 out={}
 for p in root.rglob('*'):
  if p.is_file() and '.git' not in p.parts:out[str(p.relative_to(root))]={'sha256':sha(p.read_bytes()),'mode':p.stat().st_mode&0o777,'bytes':p.stat().st_size}
 return out
def setup(d,n=10000,padding='',name=None):
 root=D/'fixtures'/(name or d);coll=root/'docs'/('decisions' if d=='dr' else 'investigations');coll.mkdir(parents=True,exist_ok=True)
 for i in range(n):(coll/f'261024-record-{i:06d}.md').write_text(body(d,i,padding))
 c,_=command('base',d,root,'sync');r=subprocess.run(c,capture_output=True,text=True,timeout=180)
 (D/'logs'/f'prepare-{name or d}.json').write_text(json.dumps({'cmd':c,'code':r.returncode,'stdout':r.stdout,'stderr':r.stderr},ensure_ascii=False,indent=2));assert r.returncode==0,r.stderr
 idx=coll/('decision-index.json' if d=='dr' else 'investigation-index.json');(D/'logs'/f'baseline-index-{name or d}.json').write_bytes(idx.read_bytes())
 t=tree(root);(D/'logs'/f'fixture-{name or d}.json').write_text(json.dumps({'count':n,'files':len(t),'sourceBytes':sum(x['bytes'] for p,x in t.items() if p.endswith('.md')),'treeSha256':sha(json.dumps(t,sort_keys=True).encode()),'tree':t},ensure_ascii=False))
 return root

def run(v,d,case,iteration,probe=False,root=None,label=None,source=False):
 root=root or D/'fixtures'/d;coll=root/'docs'/('decisions' if d=='dr' else 'investigations');idx=coll/('decision-index.json' if d=='dr' else 'investigation-index.json');first=coll/'261024-record-000000.md';normal=body(d,0)
 if root.name in ['dr','ir']:
  idx.write_bytes((D/'logs'/f'baseline-index-{d}.json').read_bytes());first.write_text(normal+ ('\n补充本轮完整同步观察。\n' if case in ['changed','preflight'] else ''))
 before=tree(root);tag=label or f'{v}-{d}-{case}-{iteration}'+('-probe' if probe else '')+('-source' if source else '');prefix=D/'logs'/tag
 c,env=command(v,d,root,case,probe,source);env['PROFILE_OUT']=str(prefix)
 startedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());start=time.monotonic();failure=None
 with Path(str(prefix)+'.stdout').open('wb') as fo,Path(str(prefix)+'.stderr').open('wb') as fe:
  proc=subprocess.Popen(c,stdout=fo,stderr=fe,env=env,start_new_session=True)
  def timeout_handler(*_):
   nonlocal failure
   failure='timeout-180s';os.killpg(proc.pid,signal.SIGKILL)
  signal.signal(signal.SIGALRM,timeout_handler);signal.alarm(180)
  _,waitstatus,usage=os.wait4(proc.pid,0);signal.alarm(0)
  status=os.waitstatus_to_exitcode(waitstatus);proc.returncode=status
 wall=time.monotonic()-start
 Path(str(prefix)+'.time').write_text(f"{wall:.6f} {usage.ru_utime:.6f} {usage.ru_stime:.6f} {usage.ru_maxrss}")
 out=Path(str(prefix)+'.stdout').read_bytes();err=Path(str(prefix)+'.stderr').read_bytes()
 after=tree(root);delta={p:{'before':before.get(p),'after':after.get(p)} for p in before.keys()|after.keys() if before.get(p)!=after.get(p)}
 (Path(str(prefix)+'.stdout')).write_bytes(out);(Path(str(prefix)+'.stderr')).write_bytes(err)
 metric={'startedAt':startedAt,'finishedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'tag':tag,'variant':v,'domain':d,'case':case,'iteration':iteration,'probe':probe,'source':source,'argv':c,'exit':status,'failure':failure,'wall':wall,'time':Path(str(prefix)+'.time').read_text().strip(),'stdoutSha256':sha(out),'stderrSha256':sha(err),'indexSha256':sha(idx.read_bytes()),'delta':delta}
 with (D/'metrics.jsonl').open('a') as f:f.write(json.dumps(metric,ensure_ascii=False)+'\n')
 print(tag,status,round(wall,3),metric['time'],list(delta),flush=True)
 assert status==0,(tag,err.decode(errors='replace')[:2000]);assert (case!='changed' or len(delta)==1),(tag,delta);assert (case=='changed' or not delta),(tag,delta)
 return metric
if __name__=='__main__':
 phase=sys.argv[1]
 if phase=='setup':
  for d in ['dr','ir']:setup(d)
 elif phase=='matrix':
  for d in ['dr','ir']:
   for case in ['check','sync','changed','preflight']:
    for i in range(3):run('base',d,case,i)
    run('base-probe',d,case,0,True)
 elif phase=='prototype':
  for case in ['check','sync','changed','preflight']:
   for i in range(3):
    for v in (['base','proto'] if i%2==0 else ['proto','base']):run(v,'dr',case,i,label=f'pair-{case}-{i}-{v}')
  for case in ['check','sync']:run('proto-probe','dr',case,0,True)
 elif phase=='smoke':
  for d in ['dr','ir']:
   root=setup(d,3,name=d+'-smoke')
   for v in ['base','proto','base-probe']:
    run(v,d,'check',0,probe=v.endswith('probe'),root=root)
   run('base',d,'check',0,root=root,source=True)

```

## fix-measure.py

```python
from pathlib import Path
p=Path(__file__).with_name('bench.py');s=p.read_text().replace('import subprocess,json,time,hashlib,os,shutil,sys','import subprocess,json,time,hashlib,os,shutil,sys,signal')
a=s.index(" start=time.monotonic();timed=");b=s.index('\n after=tree(root);',a)
s=s[:a]+''' start=time.monotonic();failure=None
 with Path(str(prefix)+'.stdout').open('wb') as fo,Path(str(prefix)+'.stderr').open('wb') as fe:
  proc=subprocess.Popen(c,stdout=fo,stderr=fe,env=env,start_new_session=True)
  def timeout_handler(*_):
   nonlocal failure
   failure='timeout-180s';os.killpg(proc.pid,signal.SIGKILL)
  signal.signal(signal.SIGALRM,timeout_handler);signal.alarm(180)
  _,waitstatus,usage=os.wait4(proc.pid,0);signal.alarm(0)
  status=os.waitstatus_to_exitcode(waitstatus);proc.returncode=status
 wall=time.monotonic()-start
 Path(str(prefix)+'.time').write_text(f"{wall:.6f} {usage.ru_utime:.6f} {usage.ru_stime:.6f} {usage.ru_maxrss}")
 out=Path(str(prefix)+'.stdout').read_bytes();err=Path(str(prefix)+'.stderr').read_bytes()'''+s[b:]
p.write_text(s)
(Path(__file__).resolve().parents[1]/'logs/method-correction.json').write_text('{"error":"/usr/bin/time absent","effect":"smoke measured invocation did not start; fixture initial sync completed","correction":"os.wait4 child resource usage and monotonic wall, no external utility","discardedSamples":0}')

```

## profile-runtime.ts

```typescript
import fs from 'node:fs';
import {threadId} from 'node:worker_threads';
const data={pid:process.pid,threadId,calls:{},events:[],reads:{success:0,failed:0,bytes:0}};
export function prof(name,fn,args){
 const start=performance.now(); const c=data.calls[name]??={count:0,ms:0};c.count++;
 const read=name.endsWith(':forEachRecordText');
 if(read){const consume=args[2];args[2]=(r,i)=>{r.ok?(data.reads.success++,data.reads.bytes+=Buffer.byteLength(r.value)):data.reads.failed++;return consume(r,i)}}
 const finish=()=>{c.ms+=performance.now()-start;if(!/parse|IdFrom|normalize/.test(name))data.events.push({name,at:performance.now(),memory:process.memoryUsage()})};
 try{const r=fn();if(r&&typeof r.then==='function')return r.then(x=>{finish();return x},e=>{finish();throw e});finish();return r}catch(e){finish();throw e}
}
process.on('exit',()=>{if(process.env.PROFILE_OUT)fs.writeFileSync(`${process.env.PROFILE_OUT}.${process.pid}-${threadId}.json`,JSON.stringify(data))});

```

## loader.mjs

```javascript
import {registerHooks} from 'node:module';import fs from 'node:fs';import {createHash} from 'node:crypto';import {threadId} from 'node:worker_threads';
const files={};registerHooks({load(url,context,next){const r=next(url,context);if(url.startsWith('file:')){try{const b=fs.readFileSync(new URL(url));files[url]={sha256:createHash('sha256').update(b).digest('hex'),bytes:b.length}}catch(e){files[url]={error:String(e)}}}return r}});
process.on('exit',()=>{if(process.env.PROFILE_OUT)fs.writeFileSync(`${process.env.PROFILE_OUT}.loaded-${process.pid}-${threadId}.json`,JSON.stringify(files))});

```

## instrument.py

```python
from pathlib import Path
import shutil,re
D=Path(__file__).resolve().parents[1]
functions={
'decision-records/src/scan-snapshot.ts':['scanDecisionSnapshot','acquireDecisionCollection','scanCollectedSourceFiles'],
'decision-records/src/scan-collection.ts':['validateSourceMembership','acquireCollectionText'],
'decision-records/src/scan-records.ts':['scanSourceFiles'],
'decision-records/src/decision-metadata.ts':['parseDecisionMarkdown','decisionIdFromMarkdown'],
'shared/src/markdown/frontmatter.ts':['parseYamlFrontmatter'],
'decision-records/src/record.ts':['validateDecisionBody'],
'decision-records/src/decision-source-revision.ts':['decisionSourceRevision'],
'decision-records/src/decision-state-snapshot.ts':['buildDecisionStateSnapshotFromSources'],
'investigation-report/src/investigation-layout.ts':['inspectInvestigationCollectionLayout'],
'investigation-report/src/validation-collection.ts':['collectValidatedInvestigationCollection','collectionStates'],
'investigation-report/src/markdown.ts':['parseInvestigationReport','investigationIdFromMarkdown'],
'investigation-report/src/resources.ts':['validateFullInvestigationResources','validateResourceIds','unreferencedResourceWarnings'],
'investigation-report/src/investigation-source-revision.ts':['prepareInvestigationSources'],
'record-operations/src/reader-batch.ts':['forEachRecordText'],
'record-operations/src/check.ts':['checkCollectedRecordIndex'],
'record-operations/src/synchronize.ts':['synchronizeRecordIndex']}
for variant in ['base','proto']:
 target=D/(variant+'-probe');target.mkdir(exist_ok=True)
 shutil.copytree(D/variant/'skills',target/'skills',dirs_exist_ok=True)
 (target/'node_modules').symlink_to(D/'base/node_modules',target_is_directory=True)
 shutil.copy2(D/'base/package.json',target/'package.json')
 for skill in ['decision-records','investigation-report']:
  root=target/'skills'/skill/'scripts/runtime/tools'
  for file,names in functions.items():
   p=root/file
   if not p.exists():continue
   s=p.read_text();s='import {prof as __prof} from '+repr(str(D/'methods/profile-runtime.ts'))+';\n'+s
   for name in names:
    pattern=r'(export )?(async )?function '+name+r'(?=[(<])'
    m=re.search(pattern,s);assert m,(file,name)
    exported=bool(m[1]);s=s[:m.start()]+m[0].replace('export ','').replace('function '+name,'function __original_'+name)+s[m.end():]
    s+='\n'+('export ' if exported else '')+'const '+name+'=(...a)=>__prof('+repr(file+':'+name)+',()=>__original_'+name+'(...a),a);\n'
   p.write_text(s)
print('instrumented isolated variants')

```

## instrument-proto.py

```python
from pathlib import Path
import shutil,re
D=Path(__file__).resolve().parents[1]
functions={
'decision-records/src/scan-snapshot.ts':['scanDecisionSnapshot','acquireDecisionCollection','scanCollectedSourceFiles'],
'decision-records/src/scan-collection.ts':['validateSourceMembership','acquireCollectionText'],
'decision-records/src/scan-records.ts':['scanSourceFiles'],
'decision-records/src/decision-metadata.ts':['parseDecisionMarkdown','decisionIdFromMarkdown'],
'shared/src/markdown/frontmatter.ts':['parseYamlFrontmatter'],
'decision-records/src/record.ts':['validateDecisionBody'],
'decision-records/src/decision-source-revision.ts':['decisionSourceRevision'],
'decision-records/src/decision-state-snapshot.ts':['buildDecisionStateSnapshotFromSources'],
'investigation-report/src/investigation-layout.ts':['inspectInvestigationCollectionLayout'],
'investigation-report/src/validation-collection.ts':['collectValidatedInvestigationCollection','collectionStates'],
'investigation-report/src/markdown.ts':['parseInvestigationReport','investigationIdFromMarkdown'],
'investigation-report/src/resources.ts':['validateFullInvestigationResources','validateResourceIds','unreferencedResourceWarnings'],
'investigation-report/src/investigation-source-revision.ts':['prepareInvestigationSources'],
'record-operations/src/reader-batch.ts':['forEachRecordText'],
'record-operations/src/check.ts':['checkCollectedRecordIndex'],
'record-operations/src/synchronize.ts':['synchronizeRecordIndex']}
for variant in ['proto']:
 target=D/(variant+'-probe');target.mkdir(exist_ok=True)
 shutil.copytree(D/variant/'skills',target/'skills',dirs_exist_ok=True)
 if not (target/'node_modules').exists():(target/'node_modules').symlink_to(D/'base/node_modules',target_is_directory=True)
 shutil.copy2(D/'base/package.json',target/'package.json')
 for skill in ['decision-records','investigation-report']:
  root=target/'skills'/skill/'scripts/runtime/tools'
  for file,names in functions.items():
   p=root/file
   if not p.exists():continue
   s=p.read_text();s='import {prof as __prof} from '+repr(str(D/'methods/profile-runtime.ts'))+';\n'+s
   for name in names:
    pattern=r'(export )?(async )?function '+name+r'(?=[(<])'
    m=re.search(pattern,s);assert m,(file,name)
    exported=bool(m[1]);s=s[:m.start()]+m[0].replace('export ','').replace('function '+name,'function __original_'+name)+s[m.end():]
    s+='\n'+('export ' if exported else '')+'const '+name+'=(...a)=>__prof('+repr(file+':'+name)+',()=>__original_'+name+'(...a),a);\n'
   p.write_text(s)
print('instrumented isolated variants')

```

## patch-prototype.py

```python
from pathlib import Path
import difflib,json
D=Path(__file__).resolve().parents[1];P=D/'proto'
def edit(root,name,changes):
 p=root/name;s=p.read_text();old=s
 for a,b in changes:
  assert a in s,(name,a);s=s.replace(a,b,1)
 p.write_text(s)
 return ''.join(difflib.unified_diff(old.splitlines(True),s.splitlines(True),fromfile='base/'+name,tofile='proto/'+name))
patch=''
for root in [P/'tools',P/'skills/decision-records/scripts/runtime/tools']:
 patch+=edit(root,'decision-records/src/scan-contracts.ts',[( 'export type SourceFile = {','export type SourceFile = {\n  sourceFrontmatter?: import("../../shared/src/markdown/frontmatter.ts").Frontmatter | null;')])
 patch+=edit(root,'decision-records/src/scan-collection.ts',[
 ('import { decisionIdFromMarkdown } from "./decision-metadata.ts";','import { decisionIdFromMarkdown } from "./decision-metadata.ts";\nimport { parseYamlFrontmatter } from "../../shared/src/markdown/frontmatter.ts";'),
 ('decisionId = decisionIdFromMarkdown(text);','sourceFile.sourceFrontmatter = parseYamlFrontmatter(text.replace(/^\\uFEFF/, "").replace(/\\r\\n/g, "\\n"));\n      decisionId = decisionIdFromMarkdown(text, sourceFile.sourceFrontmatter);')])
 patch+=edit(root,'decision-records/src/decision-metadata.ts',[
 ('relativePath: string;\n}): ParsedDecisionMarkdown','relativePath: string;\n  sourceFrontmatter?: ReturnType<typeof parseYamlFrontmatter>;\n}): ParsedDecisionMarkdown'),
 ('const frontmatter = parseYamlFrontmatter(markdown);','const frontmatter = options.sourceFrontmatter === undefined ? parseYamlFrontmatter(markdown) : options.sourceFrontmatter;'),
 ('decisionIdFromMarkdown(markdown: string): DecisionId | null {\n  return decisionSourceIdentityFromMarkdown(markdown).decisionId;','decisionIdFromMarkdown(markdown: string, sourceFrontmatter?: ReturnType<typeof parseYamlFrontmatter>): DecisionId | null {\n  return decisionSourceIdentityFromMarkdown(markdown, sourceFrontmatter).decisionId;'),
 ('decisionSourceIdentityFromMarkdown(markdown: string): Readonly<{','decisionSourceIdentityFromMarkdown(markdown: string, sourceFrontmatter?: ReturnType<typeof parseYamlFrontmatter>): Readonly<{'),
 ('const frontmatter = parseYamlFrontmatter(\n    markdown.replace(/^\\uFEFF/, "").replace(/\\r\\n/g, "\\n")\n  );','const frontmatter = sourceFrontmatter === undefined ? parseYamlFrontmatter(\n    markdown.replace(/^\\uFEFF/, "").replace(/\\r\\n/g, "\\n")\n  ) : sourceFrontmatter;')])
 patch+=edit(root,'decision-records/src/record.ts',[
 ('body: string;\n  /** @deprecated','body: string;\n  sourceFrontmatter?: import("../../shared/src/markdown/frontmatter.ts").Frontmatter | null;\n  /** @deprecated'),
 ('function decisionMarkdownParseOptions(options: {\n  body: string;','function decisionMarkdownParseOptions(options: {\n  sourceFrontmatter?: import("../../shared/src/markdown/frontmatter.ts").Frontmatter | null;\n  body: string;'),
 ('errors: options.errors,\n    markdown: options.body,','errors: options.errors,\n    sourceFrontmatter: options.sourceFrontmatter,\n    markdown: options.body,')])
 patch+=edit(root,'decision-records/src/scan-records.ts',[( 'body: sourceText,\n    errors: recordErrors,','body: sourceText,\n    sourceFrontmatter: sourceFile.sourceFrontmatter,\n    errors: recordErrors,')])
(D/'prototype.patch').write_text(patch)
print('prototype patch bytes',len(patch))

```

## patch-ir-prototype.py

```python
from pathlib import Path
import difflib
D=Path(__file__).resolve().parents[1]
pats=[D/'proto/tools/investigation-report/src/markdown.ts',D/'proto/skills/investigation-report/scripts/runtime/tools/investigation-report/src/markdown.ts']
with (D/'prototype-ir.patch').open('w') as f:
 for p in pats:
  old=p.read_text();s=old.replace('return investigationIdFromFrontmatter(\n    normalizeMarkdownNewlines(markdown).split("\\n")\n  );','return investigationIdFromFrontmatter(markdown.split(/\\r\\n?|\\n/u, 3));')
  assert s!=old;p.write_text(s);f.write(''.join(difflib.unified_diff(old.splitlines(True),s.splitlines(True),fromfile=str(p).replace('/proto/','/base/'),tofile=str(p))))

```

## correctness.py

```python
from pathlib import Path
import sys,subprocess,json,shutil,hashlib
sys.path.insert(0,str(Path(__file__).parent));from bench import D,setup,body,command,tree,sha
root=setup('dr',3,name='dr-correctness');coll=root/'docs/decisions';original={p.name:p.read_bytes() for p in coll.iterdir() if p.is_file()}
mutations={
'valid':lambda t:t,
'bom-crlf':lambda t:'\ufeff'+t.replace('\n','\r\n'),
'bad-yaml':lambda t:t.replace('title: 记录 0','title: [broken'),
'unknown-field':lambda t:t.replace('status: active','unexpected: true\nstatus: active'),
'bad-tag':lambda t:t.replace('- performance','- INVALID'),
'missing-body-heading':lambda t:t.replace('## 目的','## 未知'),
'wrong-id-type':lambda t:t.replace('id: 261024-record-000000','id: 123'),
'duplicate-id':lambda t:t.replace('id: 261024-record-000000','id: 261024-record-000001'),
'non-map-yaml':lambda t:'---\n- hello\n---\n'+t.split('---\n',2)[-1],
'duplicate-yaml-key':lambda t:t.replace('status: active','status: active\nstatus: active'),
'missing-target':lambda t:t.replace('relations: []','relations:\n  - type: 补充\n    target: 261024-missing'),
'empty-adopt':lambda t:t.replace('- 采用: 维持行为。','- 采用: ')}
results=[]
for name,mutate in mutations.items():
 for p,b in original.items():(coll/p).write_bytes(b)
 first=coll/'261024-record-000000.md';first.write_bytes(mutate(body('dr',0)).encode());before=tree(root);samples=[]
 for variant in ['base','proto']:
  c,env=command(variant,'dr',root,'check');r=subprocess.run(c,capture_output=True,env=env,timeout=30)
  samples.append({'variant':variant,'exit':r.returncode,'stdout':r.stdout.decode(),'stderr':r.stderr.decode(),'tree':tree(root)})
 assert samples[0]['exit']==samples[1]['exit']
 assert samples[0]['stdout']==samples[1]['stdout'],name
 assert samples[0]['stderr']==samples[1]['stderr'],name
 assert samples[0]['tree']==samples[1]['tree']==before,name
 results.append({'case':name,'exit':samples[0]['exit'],'stdout':samples[0]['stdout'],'stderr':samples[0]['stderr'],'outputAndWriteSetEqual':True})
(D/'correctness.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print('correctness cases',len(results))

```

## identity-correctness.mjs

```javascript
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {investigationIdFromMarkdown as base} from '../base/tools/investigation-report/src/markdown.ts';
import {investigationIdFromMarkdown as proto} from '../proto/tools/investigation-report/src/markdown.ts';
const samples=[];const good='---\ntitle: "Title"\nid: "261024-example"\nformedAt: "2026-10-24T00:00:00Z"\n---\nbody\n';
for(const nl of ['\n','\r\n','\r'])for(const prefix of ['','\ufeff'])for(const suffix of ['','x'.repeat(200000),'\n'.repeat(20000)])samples.push({name:`good-${JSON.stringify(nl)}-${prefix?'bom':'plain'}-${suffix.length}`,text:prefix+good.replaceAll('\n',nl)+suffix});
for(const text of ['', '\n','---','---\ntitle: "T"','---\ntitle: "T"\nid: 123','---\ntitle: "T"\nid: "bad / id"','---\ntitle: "T"\nid: "261024-example"','---\ntitle: "T"\rid: "261024-example"\r\nbody'])samples.push({name:'edge',text});
let seed=27;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed};
for(let i=0;i<1000;i++){let t=good;for(let k=0;k<5;k++){const at=rand()%t.length;t=t.slice(0,at)+['\r','\n','\r\n','x','\ufeff'][rand()%5]+t.slice(at+(rand()%2))}samples.push({name:`seed27-${i}`,text:t})}
const results=samples.map(s=>{const b=base(s.text),p=proto(s.text);if(b!==p)throw Error(`mismatch ${s.name}`);return {name:s.name,sha256:createHash('sha256').update(s.text).digest('hex'),chars:s.text.length,result:b,equal:true}});
fs.writeFileSync(new URL('../identity-correctness.json',import.meta.url),JSON.stringify({normalization:'base replaces CRLF and bare CR with LF; no BOM removal; prototype split has same three leading lines',samples:results},null,2));console.log('IR identity equality cases',results.length)

```

## quiet-and-long.py

```python
from pathlib import Path
import sys,subprocess,json,time
sys.path.insert(0,str(Path(__file__).parent));from bench import D,setup,run
host=subprocess.check_output(['ps','-eo','pid,ppid,pcpu,rss,etime,args','--sort=-pcpu'],text=True)
(D/'logs/host-before-quiet.txt').write_text(time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())+'\n'+host)
assert not any('correctness.py' in line and 'python' in line and 'bash' not in line for line in host.splitlines())
for i in range(3):
 for v in (['base','proto'] if i%2==0 else ['proto','base']):run(v,'dr','check',i,label=f'quiet-check-{i}-{v}')
for i in range(3):
 for v in (['base','proto'] if i%2==0 else ['proto','base']):run(v,'ir','check',i,label=f'short-ir-pair-{i}-{v}')
# Warm-cache 10k long-report form; setup has a real full source sync, outside timed samples.
padding=('Long-form-body-0123456789abcdef'*8+'\n')*32
root=setup('ir',10000,padding,name='ir-long')
for i in range(3):
 for v in (['base','proto'] if i%2==0 else ['proto','base']):run(v,'ir','check',i,root=root,label=f'long-pair-{i}-{v}')
for v in ['base-probe','proto-probe']:run(v,'ir','check',0,True,root=root,label=f'long-{v}')

```

## summarize.py

```python
from pathlib import Path
import json,statistics as S,glob,hashlib,urllib.parse,csv
D=Path(__file__).resolve().parents[1];rows=[json.loads(l) for l in (D/'metrics.jsonl').read_text().splitlines()]
for row in rows:
 t=row['tag']
 if any('/fixtures/'+x+'-smoke' in ' '.join(row['argv']) for x in ['dr','ir']):row['population']='smoke'
 elif t.startswith('quiet-check'):row['population']='quiet-dr-check-ab'
 elif t.startswith('long-'):row['population']='long-ir-check-ab' if not row['probe'] else 'long-ir-probe'
 elif t.startswith('short-ir-pair'):row['population']='short-ir-check-ab'
 elif t.startswith('pair-check'):row['population']='initial-dr-check-ab-possible-correctness-overlap'
 elif t.startswith('pair-'):row['population']='dr-other-ab'
 elif row['variant'].startswith('proto'):row['population']='prototype-probe'
 else:row['population']='matrix'
 f=row['time'].split();row['user']=float(f[1]);row['sys']=float(f[2]);row['cpu']=row['user']+row['sys'];row['rssMiB']=int(f[3])/1024

groups={}
for r in rows:
 if r['probe'] or r['population']=='smoke':continue
 key=(r['population'],r['domain'],r['case'],r['variant']);groups.setdefault(key,[]).append(r)
summary=[]
for key,rs in groups.items():
 result=dict(zip(['population','domain','case','variant'],key));result['n']=len(rs)
 for field in ['wall','cpu','rssMiB']:
  v=[r[field] for r in rs];result[field]={'min':min(v),'median':S.median(v),'max':max(v)}
 summary.append(result)
(D/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));(D/'classified-metrics.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
with (D/'summary.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['population','domain','case','variant','n','wallMin','wallMedian','wallMax','cpuMedian','rssMedianMiB','rssMaxMiB'])
 for r in summary:w.writerow([r[x] for x in ['population','domain','case','variant','n']]+[round(r['wall'][x],3) for x in ['min','median','max']]+[round(r['cpu']['median'],3),round(r['rssMiB']['median'],1),round(r['rssMiB']['max'],1)])
# Probes are separate observations. Omit per-record memory samples but retain every function count and inclusive time.
profiles=[]
for p in sorted((D/'logs').glob('*.json')):
 if '.loaded-' in p.name or not '-probe.' in p.name:continue
 a=json.loads(p.read_text())
 if 'calls' not in a:continue
 events=[e for e in a['events'] if not e['name'].endswith(':validateDecisionBody')]
 profiles.append({'source':p.name,'reads':a['reads'],'calls':a['calls'],'stageEndMemory':events,'omittedPerRecordMemoryEvents':len(a['events'])-len(events)})
(D/'profiles-summary.json').write_text(json.dumps(profiles,ensure_ascii=False,indent=2))
# Module closure discovered by actual ESM/CJS hooks, including worker, outside normal timing.
loaded={}
for p in (D/'logs').glob('*.loaded-*.json'):
 for url,v in json.loads(p.read_text()).items():loaded[urllib.parse.urlparse(url).path]=v
(D/'loaded-files.json').write_text(json.dumps(loaded,ensure_ascii=False,indent=2))
print((D/'summary.csv').read_text())

```
