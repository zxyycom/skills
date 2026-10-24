# 落地版性能复测：方法与证据边界

## 阅读用途与版本

本资源解释两份调查在 2026-10-24 对落地版的性能复测。受测版本固定为 `ef809161ad8921f6e6a2ff4ee7802cef1037f58b`（DR 98、IR 87），Node v26.8.2 直接运行隔离的生成 CLI，核对分发边界性能及源码／生成一致性。仓库报告维护仍使用公开短命令。

主报告使用 **19:32:05–19:37:17 UTC 修正窗口**。首轮 RSS 受计量父进程影响，全部原始值仍保留供审查，两窗口分别统计；以下说明对照、修正依据和后验范围，下附实际采样代码及输入模板。

## 同一闭包上的单项对照

| 版本标识 | 内容 |
| --- | --- |
| `current` | 上述版本的原样副本，启用 DR frontmatter 复用与 envelope 原地冻结。 |
| `without-frontmatter` | 仅将七份 DR 源码及对应七份生成文件替换为 `46f386a38773efb780c640bc997bc911c37ca4f3` 的内容，撤回复用及后续只读边界收紧；envelope 和其余工具保持落地版。 |
| `without-envelope` | 仅将源码及两份生成 runtime 的 `snapshot-parser.ts` 替换为 `6dd2a4e6953e145581353fd21b124c8c24993e27` 的内容，恢复递归 JSON 复检、复制及冻结；DR 复用保持落地版。 |

比较限于同一闭包的单项撤回，不与历史计时混算，也不估计两因素交互。所有副本共用已复制的实际依赖，optional `supports-color` 9.4.0 在首次采样前就位；源码、生成文件和依赖的 size、mode、SHA 及链接身份在起止核对。实验只作用于隔离副本，未安装依赖、联网或改变宿主设置。闭包 smoke 加载 observer，正常性能样本不插桩。

## 输入与预定样本

输入沿用原报告 recipe，重新生成并由独立 Python／PyYAML oracle 核对。

- **全量矩阵**：每域 10,000 正式来源，无关系、资源或候选；DR／IR 正文为 3,358,890／3,408,890 B，索引为 5,359,147／4,319,152 B。changed／preflight 向第一份正文追加 35 B，保持 metadata 投影、改变 revision。IR 长文 check 使用 83,088,890 B 正文和 10,000 条来源，保持已采用实现。
- **索引矩阵**：每域 10,000 正式、9,000 稀疏关系、2 个候选；DR 9,000 archived／1,000 active，IR 一个小 owner 资源；索引为 6,303,257／5,193,312 B。selected sync 修改末条 title；stage index 只刷新所选投影，同时保留未选 pending 索引变化、未选已暂存正文及范围外 sentinel。
- **Git 夹具**：自建仓库无 remote，隔离全局／系统配置并禁用夹具自身 hooks；reset／clean 只针对这些夹具。

观察结果前固定每窗口的样本：

| 组 | 次数与顺序 |
| --- | --- |
| DR check／full sync unchanged／changed／preflight | 每场景 3 对，共 24 次；撤回→落地、落地→撤回、撤回→落地。 |
| IR 相同四场景 | 落地版各 3 次，共 12 次，观察该版本时延与内存。 |
| 两域 selected sync／stage index | 每场景 3 对，共 24 次，配对顺序同 DR 全量组。 |
| IR 长文 check | 落地版 3 次。 |
| 闭包 smoke | 正常计时外做 14 次：三条来源输入的 DR 落地／撤回版及 IR 落地版，分别运行 source／generated check（6 次）；索引四场景的两个版本各一次（8 次）。 |

每窗口 **63 次正常＋14 次 smoke**；各正常组交错执行，保留全部实际启动样本，不按结果补抽、替换或删除。夹具初始化 sync 另存准备结果。

## RSS 修正与完整重跑

首轮 63 次正常＋14 次 smoke 的 CLI 和后验均成功。长文后验后，不同入口的 `wait4 ru_maxrss` 反复出现相同的 506,352 KiB，并随计量父进程增长。19:31 UTC 对同一最小 Node 进程做三个控制：

| 启动条件 | wait4 峰值 RSS KiB |
| --- | ---: |
| resident 15,728 KiB 的父进程直接启动 | 45,072 |
| 父进程再分配 256 MiB 后直接启动 | 277,636 |
| 经 resident 15,316 KiB 的独立计量进程启动 | 44,980 |

第二项 Node 当时 resident 仍约 43.4 MiB，`resourceUsage().maxRSS` 也含前序峰值。控制支持将污染定位到 fork 前父进程驻留高水位，而非产品当前内存。

修正后，大 oracle 父进程只负责输入恢复和后验，小型独立进程负责 Popen／wait4。计量器启动在产品 wall 外，Node 启动及收尾仍在其中；每条样本保存 `collectorResidentKiB`，实测 15,096–15,328 KiB。随后**完整重跑相同矩阵**。

两轮共 126 次正常＋28 次 smoke，以 `measurementWindow` 区分；3 个控制另存。首轮时长可审查，RSS 不用于产品内存比较；该发现仅针对本次父进程分配形态，不反向判定历史样本污染。

## 计量、后验与解释边界

- **进程与指标**：清除继承的 NODE_OPTIONS、NODE_PATH、覆盖率和编译缓存设置，新 Node 进程串行执行。wall 从 Popen 前 monotonic 至 wait4 返回；CPU 为 wait4 user+system；RSS 为 Linux wait4 高水位（KiB÷1024 为 MiB），含 Node worker 线程，不等于同时进程树总内存或 JS live heap。
- **执行与环境**：600 秒上限只终止自有进程组。准备、恢复、全树读取／哈希、oracle 和后验在计时外，缓存已暖；保持宿主缓存、GC、频率、核心及 worker 设置。每次前后记录 Node/Bun 进程摘要与 cgroup CPU／memory；端点及进程生命周期平均 CPU% 无法排除短命进程或宿主活动，cgroup 内存也不代替产品 RSS。
- **全量后验**：核对所有普通文件 SHA／size／mode，只有 changed 可改索引；check／unchanged／changed 独立核对完整投影、revision 和资源引用。preflight 保持刻意陈旧的索引，仅证明无最终改写。
- **索引后验**：核对完整 W、P 的 mode／OID／payload 身份及 HEAD；selected sync 验证全部投影和来源 revision；stage 独立组合旧 pending＋所选工作区投影，核对未选身份不变。每对完整输出及最终效果相等，索引正常样本另与同版 smoke 比较。
- **统计与证明范围**：每组 3 次，保存 min／median／max 和逐对变化；中位变化为落地组中位÷撤回组中位−1。所有变慢、CPU／RSS 上升均保留。最终状态不覆盖瞬态写入或同字节改写；小样本不足以给出显著性、生产 p95、稳定倍数或容量上界。

本次未重做阶段插桩、YAML／FS／Git 调用计数或 retained-heap／GC 实验。既有工作量和正确性证据保留其取得时点，端到端差额的具体因果归属仍未知。

## 数据入口与归宿

两个 `current-version-samples.jsonl` 分别保存各矩阵两窗口的正常和 smoke 行，包括 UTC、退出、完整输出引用、指标和失败字段；`current-version-results.json` 分窗口保存分组、逐对变化及反向计数。共享 provenance 保存来源、起止闭包、输入、控制及历史资源保真审计。

`measurementWindow`／`sampleId` 区分窗口与样本。实验绝对根展示为 `<experiment-root>`；原始输出 bytes／SHA 保持原值，展示文本另存 SHA。完整输出按原始 SHA 去重至 `current-version-streams.json`，样本以 `displayTextRef` 引用，其中包含 DR stage 的 462,391 B 全路径输出。

下附代码供阅读复核，宿主路径替换为角色标记；重跑需重新准备夹具和依赖，不作为资源目录内的长期执行入口。资源落盘并审计后，本次实验的夹具、依赖副本、身份地图及原始日志已清理；历史报告资源保持原字节。

## 实际方法代码

以下为执行文件的完整阅读副本；SHA 为路径展示替换前的实际文件。初始化提取器和本资源导出器不参与计量，省略其实现。

### freeze_current.py

原文件 4085 B，SHA-256 `1a91fbaee6ddd2093f3176453a246e0a993e338d4c9ed3578260c85e63011260`。

`````python
from pathlib import Path
import subprocess,shutil,hashlib,json,os,platform,datetime
R=Path(__file__).resolve().parents[1]; W=Path('<repository-root>')
paths=['tools','skills/decision-records','skills/investigation-report','package.json','pnpm-lock.yaml']
def manifest(base,rels):
 out={}
 for rel in rels:
  p=base/rel
  fs=[p] if p.is_file() else [Path(d)/f for d,ns,fs in os.walk(p,followlinks=False) for f in ns+fs if (Path(d)/f).is_symlink() or (Path(d)/f).is_file()]
  for p in fs:
   out[str(p.relative_to(base))]={'link':os.readlink(p)} if p.is_symlink() else {'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mode':p.stat().st_mode&0o777}
 return out
def fingerprint(v):return hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def copy_sources(base,target):
 target.mkdir()
 for rel in paths:
  p=base/rel;t=target/rel;t.parent.mkdir(parents=True,exist_ok=True)
  if p.is_dir():shutil.copytree(p,t,symlinks=True)
  else:shutil.copy2(p,t)
def old_file(ref,rel):return subprocess.check_output(['git','show',ref+':'+rel],cwd=W)
if __name__=='__main__':
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=W,text=True).strip()
 source=manifest(W,paths);current=R/'current';copy_sources(W,current)
 assert source==manifest(W,paths)==manifest(current,paths)
 deps=manifest(W,['node_modules']);shutil.copytree(W/'node_modules',current/'node_modules',symlinks=True)
 assert deps==manifest(W,['node_modules'])==manifest(current,['node_modules'])
 optional={}
 for name in ['supports-color']:
  if not (current/'node_modules'/name).exists():
   src=Path('<existing-optional-dependencies>')/name;assert src.is_dir()
   before=manifest(src.parent,[name]);shutil.copytree(src,current/'node_modules'/name,symlinks=True)
   assert before==manifest(src.parent,[name])==manifest(current/'node_modules',[name]);optional[name]=before
 deps=manifest(current,['node_modules']);save(R/'dependency-manifest.json',deps)
 variants={'current':source}; reversions={}
 files=subprocess.check_output(['git','diff','--name-only','6dd2a4e6^',head,'--','tools/decision-records/src'],cwd=W,text=True).splitlines()
 assert len(files)==7
 for variant,ref,rels in [('without-frontmatter','6dd2a4e6^',files),('without-envelope','d3320ce9^',['tools/index-runtime/src/snapshot-parser.ts'])]:
  target=R/variant;copy_sources(current,target);(target/'node_modules').symlink_to('../current/node_modules')
  replaced=[]
  for rel in rels:
   targets=[rel]+['skills/'+s+'/scripts/runtime/'+rel for s in ['decision-records','investigation-report'] if (target/'skills'/s/'scripts/runtime'/rel).exists()]
   for dest in targets:(target/dest).write_bytes(old_file(ref,dest));replaced.append(dest)
  variants[variant]=manifest(target,paths);reversions[variant]={'ref':subprocess.check_output(['git','rev-parse',ref],cwd=W,text=True).strip(),'replaced':replaced}
  diffs=[k for k in source.keys()|variants[variant].keys() if source.get(k)!=variants[variant].get(k)];assert set(diffs)==set(replaced)
  patch=subprocess.run(['diff','-ru',str(current/'tools'),str(target/'tools')],capture_output=True).stdout
  (R/(variant+'.patch')).write_bytes(patch)
 for v,m in variants.items():save(R/(v+'-manifest.json'),m)
 binaries={k:{'version':subprocess.check_output([k,'--version'],text=True).strip(),'sha256':hashlib.sha256(Path(shutil.which(k)).read_bytes()).hexdigest()} for k in ['node','git','python']}
 env={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':head,'sourceFingerprints':{v:fingerprint(m) for v,m in variants.items()},'dependencyFingerprint':fingerprint(deps),'dependencyFiles':len(deps),'sourceCounts':{v:len(m) for v,m in variants.items()},'optionalCopied':optional,'reversions':reversions,'binaries':binaries,'platform':platform.platform(),'affinity':sorted(os.sched_getaffinity(0)),'cpus':os.cpu_count(),'cgroup':{p:Path('/sys/fs/cgroup/'+p).read_text().strip() for p in ['cpu.max','memory.max']}}
 save(R/'environment.json',env);print(json.dumps(env,ensure_ascii=False))

`````

### global_body.py

原文件 983 B，SHA-256 `4dd88c8ab5bea9f081d5932dae32365642523442bb8a5cc5cb1256e9c972442b`。

`````python
from pathlib import Path
import subprocess,json,time,hashlib,os,shutil,sys,signal
D=Path(__file__).resolve().parents[1]
def sha(b):return hashlib.sha256(b).hexdigest()
def body(domain,i,padding=''):
 id=f'261024-record-{i:06d}'
 if domain=='dr':
  return f'''---\ntitle: 记录 {i}\nid: {id}\nstatus: active\nalignment: aligned\ncreatedAt: 2026-10-24T00:00:00Z\npurpose: 检查当前来源。\nbackground: 规模基准。\ndecision: 维持行为。\ntags:\n  - performance\nrelations: []\n---\n\n## 目的\n检查当前来源。\n\n## 背景\n规模基准。\n{padding}\n## 决策\n- 采用: 维持行为。\n'''
 return f'''---\ntitle: "记录 {i}"\nid: "{id}"\nformedAt: "2026-10-24T00:00:00Z"\nquestion: "全量成本是什么？"\ntags:\n  - "performance"\nrelations: []\n---\n\n## 形成时背景\n当前规模基准。\n{padding}\n## 调查目的\n量化成本。\n\n## 调查范围与依据\n当前冻结来源。\n\n## 调查结果与边界\n只适用于合成输入。\n'''

`````

### oracle.py

原文件 5739 B，SHA-256 `149dda6a0fab314e521b73cd008a86207d05bc4ff3e5dfea37a78e4793bb262b`。

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

### recreate-inputs.py

原文件 2592 B，SHA-256 `847e270922dd34e6c1ede81bf14505944bde3408afa2d46850e0e059975b025b`。

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

### prepare.py

原文件 2733 B，SHA-256 `1dda6bdeef0c9fe93d7d98487eb4ed0ebf0f20d76baece08859efa05153a2269`。

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

### closure.mjs

原文件 406 B，SHA-256 `ec620ebd8a5303cb545c599b0cf8da0a55682c7c7b7e74f91f59537d18ad001b`。

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

### rerun_corrected.py

原文件 10879 B，SHA-256 `a4b89dc740e0a41081d5cee86bab0be1a3b38f64a0f54b76cba02a45f933680d`。

`````python
"""当前落地版的串行配对矩阵；计时外恢复输入、独立验后和闭包采集。"""
from pathlib import Path
import os,json,subprocess,time,signal,sys,hashlib,datetime
from prepare import restore,R,Z,U
from global_body import body
from oracle import capture,summary,delta,collection,index_name,verify_index,pending_index,git,stable,sha,parse
from freeze_current import manifest,fingerprint,paths

os.environ.update(GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null',TZ='UTC',LC_ALL='C.UTF-8')
for key in ['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','NODE_COMPILE_CACHE']:
 os.environ.pop(key,None)

def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def cli(v,d,source=False):
 skill='decision-records' if d=='decision' else 'investigation-report'
 return R/v/('tools/'+skill+'/src/cli.ts' if source else 'skills/'+skill+'/scripts/'+('decision-records.ts' if d=='decision' else 'check-investigations.ts'))
def host():
 rows=[]
 for line in subprocess.check_output(['ps','-eo','pid,ppid,comm,pcpu,args'],text=True).splitlines()[1:]:
  a=line.split(None,4)
  if len(a)!=5:continue
  if not ('node' in a[2].lower() or 'bun' in a[2].lower() or a[2]=='MainThread'):continue
  rows.append({'pid':int(a[0]),'ppid':int(a[1]),'comm':a[2],'lifetimeCpuPercent':float(a[3]),'role':'codegraph' if 'codegraph' in a[4] else 'other'})
 return {'nodeBunProcesses':rows,'cpuStat':dict(x.split() for x in Path('/sys/fs/cgroup/cpu.stat').read_text().splitlines()),'memoryCurrentBytes':int(Path('/sys/fs/cgroup/memory.current').read_text())}
def measure(argv,cwd,out,env):
 assert not out.with_suffix('.stdout').exists()
 subprocess.run([sys.executable,str(R/'methods/measure_cli.py'),str(cwd),str(out),*argv],env=env,check=True)
 return json.loads(out.with_suffix('.metrics.json').read_text())

def tree(root):
 return {p.relative_to(root).as_posix():{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size,'mode':p.stat().st_mode&0o777} for p in sorted(root.rglob('*')) if p.is_file()}
def global_verify(root,d):
 c=collection(d);raws={};docs={};files={}
 for p in (root/c).rglob('*'):
  if not p.is_file():continue
  raw=p.read_bytes();rel=p.relative_to(root).as_posix();raws[rel]=raw;files[rel]={'sha256':sha(raw),'bytes':len(raw),'mode':p.stat().st_mode&0o777}
  if p.suffix=='.md':
   meta,b=parse(raw);docs[meta['id']]={'path':p.relative_to(root/c).as_posix(),'metadata':meta,'body':b}
 return verify_index(root,d,{'raws':raws,'docs':docs,'files':files,'index':json.loads((root/c/index_name(d)).read_bytes())})
def global_setup(d,n=10000,long=False):
 name=d+('-long' if long else '')+('-smoke' if n!=10000 else '')
 root=R/'global-fixtures'/name;c=root/collection(d);c.mkdir(parents=True)
 padding=('Long-form-body-0123456789abcdef'*8+'\n')*32 if long else ''
 for i in range(n):(c/f'261024-record-{i:06d}.md').write_text(body('dr' if d=='decision' else 'ir',i,padding))
 result=subprocess.run(['node',str(cli('current',d)),'sync-index'],cwd=root,capture_output=True)
 save(R/'logs'/('setup-'+name+'.json'),{'exit':result.returncode,'stdout':result.stdout.decode(),'stderr':result.stderr.decode()});assert result.returncode==0
 (R/'logs'/('baseline-'+name+'.json')).write_bytes((c/index_name(d)).read_bytes())
 files=tree(root);proof={'name':name,'formal':n,'sourceBytes':sum(v['bytes'] for k,v in files.items() if k.endswith('.md')),'indexBytes':(c/index_name(d)).stat().st_size,'inputSha256':stable(files),'oracle':global_verify(root,d)}
 save(R/'logs'/('input-'+name+'.json'),proof);print('setup',name,proof['sourceBytes'],flush=True)
 return root

def global_restore(d,scenario,smoke=False):
 name=d+('-long' if scenario=='long-check' else '')+('-smoke' if smoke else '')
 root=R/'global-fixtures'/name;c=root/collection(d)
 (c/index_name(d)).write_bytes((R/'logs'/('baseline-'+name+'.json')).read_bytes())
 if scenario!='long-check':
  text=body('dr' if d=='decision' else 'ir',0)
  if scenario in ['changed','preflight']:text+='\n补充本轮完整同步观察。\n'
  (c/'261024-record-000000.md').write_text(text)
 return root

def index_effect(root,d,scenario,before,after):
 idxpath=collection(d)+'/'+index_name(d);wd=delta(before['files'],after['files']);pd=delta(before['pending'],after['pending'])
 assert before['head']==after['head'];assert not git(root,'remote').strip()
 if scenario=='sync-selected':
  assert wd==[idxpath] and not pd
  proof=verify_index(root,d,after)
  expected=json.loads(json.dumps(before['index']));expected['entries'][Z]=after['index']['entries'][Z];expected['sourceRevision']['entries'][Z]=after['index']['sourceRevision']['entries'][Z];assert after['index']==expected
 else:
  assert not wd and pd==[idxpath]
  old=pending_index(root,d,before);new=pending_index(root,d,after);expected=json.loads(json.dumps(old));expected['entries'][Z]=before['index']['entries'][Z];expected['sourceRevision']['entries'][Z]=before['index']['sourceRevision']['entries'][Z]
  assert new==expected and new['entries'][U]['title']=='Pending unrelated title retained'
  for p in before['pending']:
   if p!=idxpath:assert before['pending'][p]==after['pending'][p]
  proof={'pendingIndexComposition':'passed','scopeOutsideIdentityProtection':'passed'}
 return {'worktreeChangedPaths':wd,'pendingChangedPaths':pd,'before':summary(before),'after':summary(after),'indexByteSha256':sha(after['raws'][idxpath]),'pendingIndexByteSha256':sha(git(root,'cat-file','blob',after['pending'][idxpath]['oid'])),'verification':proof}

def run(v,d,scenario,pair,suite='global',smoke=False,source=False):
 root=global_restore(d,scenario,smoke) if suite=='global' else restore(d,scenario)
 before=tree(root) if suite=='global' else capture(root,d)
 label=f'{suite}-{d}-{scenario}-{pair}-{v}'+('-smoke' if smoke else '')+('-source' if source else '')
 out=R/'corrected-logs'/label
 args=(['check'] if scenario in ['check','long-check'] else ['sync-index']+(['--preflight'] if scenario=='preflight' else [])) if suite=='global' else (['sync-index','--select',Z] if scenario=='sync-selected' else ['stage',Z,'--scope','index'])
 argv=['node'];env=dict(os.environ)
 if smoke:
  env['INDEX_COST_CLOSURE']=str(R/'corrected-logs'/('closure-'+label+'.jsonl'));argv+=['--import',str(R/'methods/closure.mjs')]
 argv +=[str(cli(v,d,source)),*args]
 host_before=host();metrics=measure(argv,root,out,env);host_after=host()
 streams={name:{'bytes':out.with_suffix('.'+name).stat().st_size,'sha256':sha(out.with_suffix('.'+name).read_bytes()),'text':out.with_suffix('.'+name).read_text()} for name in ['stdout','stderr']}
 row={'label':label,'suite':suite,'domain':d,'scenario':scenario,'variant':v,'pair':pair,'smoke':smoke,'source':source,'argv':argv,'metrics':metrics,'hostBefore':host_before,'hostAfter':host_after,'streams':streams}
 try:
  assert metrics['exitCode']==0 and not metrics['timeout'],streams['stderr']
  if suite=='global':
   after=tree(root);changed=delta(before,after);expected=[collection(d)+'/'+index_name(d)] if scenario=='changed' else []
   assert changed==expected,(changed,expected)
   proof=global_verify(root,d) if scenario!='preflight' else {'unchangedCompleteTree':'passed','note':'preflight retains intentionally stale index; source/index equivalence not expected'}
   row['effect']={'beforeSha256':stable(before),'afterSha256':stable(after),'changedPaths':changed,'indexByteSha256':sha((root/collection(d)/index_name(d)).read_bytes()),'verification':proof}
  else:row['effect']=index_effect(root,d,scenario,before,capture(root,d))
 except Exception as e:
  row['verificationError']=repr(e)
  with (R/'corrected-samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
  raise
 with (R/'corrected-samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
 print(label,round(metrics['wallSeconds'],3),round(metrics['maxRssKiB']/1024,1),flush=True)
 return row

def equal(a,b):
 assert a['streams']==b['streams'] and a['effect']==b['effect'],(a['label'],b['label'])

def finish():
 e=json.loads((R/'environment.json').read_text());proof={}
 for v,expected in e['sourceFingerprints'].items():
  actual=fingerprint(manifest(R/v,paths));assert actual==expected;proof[v]=actual
 deps=fingerprint(manifest(R/'current',['node_modules']));assert deps==e['dependencyFingerprint']
 closure=[]
 from urllib.parse import urlparse,unquote
 for p in (R/'corrected-logs').glob('closure-*.jsonl'):
  for line in p.read_text().splitlines():
   url=json.loads(line)['url'];file=Path(unquote(urlparse(url).path)).resolve();assert file.is_relative_to(R),(p,file);closure.append(str(file.relative_to(R)))
 rows=[json.loads(x) for x in (R/'corrected-samples.jsonl').read_text().splitlines()]
 assert len([x for x in rows if not x['smoke']])==63
 for row in rows:
  assert 'verificationError' not in row and row['metrics']['exitCode']==0
  if row['smoke']:continue
  matches=[s for s in rows if s['smoke'] and s['suite']==row['suite'] and s['domain']==row['domain'] and s['scenario']==row['scenario'] and s['variant']==row['variant'] and not s['source']]
  if row['suite']=='index':assert len(matches)==1;equal(row,matches[0])
 save(R/'corrected-final-audit.json',{'finishedAt':stamp(),'normalSamples':63,'smokeSamples':len(rows)-63,'failures':0,'timeout':0,'discarded':0,'sourceFingerprintsUnchanged':proof,'dependencyFingerprintUnchanged':deps,'closureFileUrlEvents':len(closure),'closureDistinctPaths':len(set(closure)),'closureAllInsideExperiment':True,'indexNormalSmokeEffectsEqual':True})

if __name__=='__main__':
 mode=sys.argv[1]
 if mode=='prepare':
  subprocess.run(['python',str(R/'methods/prepare.py')],check=True)
  for d in ['decision','investigation']:global_setup(d);global_setup(d,3)
  global_setup('investigation',long=True)
 elif mode=='smoke':
  for d,variants in [('decision',['current','without-frontmatter']),('investigation',['current'])]:
   for v in variants:
    a=run(v,d,'check',99,smoke=True);b=run(v,d,'check',99,smoke=True,source=True);equal(a,b)
  for d in ['decision','investigation']:
   for scenario in ['sync-selected','stage-index']:
    a=run('without-envelope',d,scenario,99,'index',True);b=run('current',d,scenario,99,'index',True);equal(a,b)
 elif mode=='normal':
  for pair in range(3):
   for scenario in ['check','sync','changed','preflight']:
    variants=['without-frontmatter','current'] if pair%2==0 else ['current','without-frontmatter']
    a,b=[run(v,'decision',scenario,pair) for v in variants];equal(a,b)
    run('current','investigation',scenario,pair)
   for d in ['decision','investigation']:
    for scenario in ['sync-selected','stage-index']:
     variants=['without-envelope','current'] if pair%2==0 else ['current','without-envelope']
     a,b=[run(v,d,scenario,pair,'index') for v in variants];equal(a,b)
   run('current','investigation','long-check',pair)
  finish()

`````

### measure_cli.py

原文件 1542 B，SHA-256 `f6d4691926cfd355fab61164034364e153d752466c762ebde70fff036ce374c0`。

`````python
"""以低 resident-memory 的独立父进程测量完整 CLI，避免大 oracle 父进程的 fork RSS 下限。"""
from pathlib import Path
import datetime,json,os,signal,subprocess,sys,time

def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def current_rss_kib():
 for line in Path('/proc/self/status').read_text().splitlines():
  if line.startswith('VmRSS:'):return int(line.split()[1])
 raise RuntimeError('VmRSS unavailable')
def measure(argv,cwd,out):
 timed_out=False;parent_rss=current_rss_kib()
 with out.with_suffix('.stdout').open('wb') as stdout,out.with_suffix('.stderr').open('wb') as stderr:
  started=stamp();start=time.monotonic();p=subprocess.Popen(argv,cwd=cwd,stdout=stdout,stderr=stderr,start_new_session=True)
  def expired(*_):
   nonlocal timed_out
   timed_out=True;os.killpg(p.pid,signal.SIGKILL)
  old=signal.signal(signal.SIGALRM,expired);signal.alarm(600)
  try:_,status,usage=os.wait4(p.pid,0);wall=time.monotonic()-start
  finally:signal.alarm(0);signal.signal(signal.SIGALRM,old)
  p.returncode=os.waitstatus_to_exitcode(status)
 return {'startedAt':started,'finishedAt':stamp(),'wallSeconds':wall,'cpuSeconds':usage.ru_utime+usage.ru_stime,'userSeconds':usage.ru_utime,'systemSeconds':usage.ru_stime,'maxRssKiB':usage.ru_maxrss,'exitCode':p.returncode,'timeout':timed_out,'collectorResidentKiB':parent_rss}
if __name__=='__main__':
 cwd=Path(sys.argv[1]);out=Path(sys.argv[2]);result=measure(sys.argv[3:],cwd,out)
 out.with_suffix('.metrics.json').write_text(json.dumps(result)+'\n')

`````

### collector_control.py

原文件 1486 B，SHA-256 `347c3f222aa719e74d79a77e9631416b72b2dd298cf2ab459d53320ffad97b49`。

`````python
from pathlib import Path
import json,os,subprocess,sys,time
from measure_cli import current_rss_kib
R=Path(__file__).resolve().parents[1]
argv=['node','-e','process.stdout.write(JSON.stringify({rss:process.memoryUsage().rss,maxRSS:process.resourceUsage().maxRSS}))']
def direct(label):
 p=R/'logs'/('collector-control-'+label)
 parent=current_rss_kib()
 with p.with_suffix('.stdout').open('wb') as out:
  child=subprocess.Popen(argv,stdout=out,start_new_session=True)
  _,status,usage=os.wait4(child.pid,0);child.returncode=os.waitstatus_to_exitcode(status)
 return {'label':label,'parentResidentKiB':parent,'exit':child.returncode,'wait4MaxRssKiB':usage.ru_maxrss,'node':json.loads(p.with_suffix('.stdout').read_text())}
rows=[direct('small-parent')]
retained=bytearray(256*1024*1024)
rows.append(direct('large-parent'))
p=R/'logs'/'collector-control-isolated'
subprocess.run([sys.executable,str(R/'methods/measure_cli.py'),str(R),str(p),*argv],check=True)
rows.append({'label':'large-parent-isolated-collector','parentResidentKiB':current_rss_kib(),'metrics':json.loads(p.with_suffix('.metrics.json').read_text()),'node':json.loads(p.with_suffix('.stdout').read_text())})
(R/'collector-control.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows,indent=2))
assert all(r.get('exit',r.get('metrics',{}).get('exitCode'))==0 for r in rows)
assert rows[1]['wait4MaxRssKiB']>rows[0]['wait4MaxRssKiB']*2
assert rows[2]['metrics']['maxRssKiB']<rows[1]['wait4MaxRssKiB']/2

`````

### summarize_current.py

原文件 3005 B，SHA-256 `4dd3d1f9bac11f3a6a3c4abadde1918df5f2273c5ffda745c6a1cc0db73945a1`。

`````python
from pathlib import Path
import json,statistics,sys
R=Path(__file__).resolve().parents[1]
def stats(values):return {'min':min(values),'median':statistics.median(values),'max':max(values)}
def compute(rows):
 normal=[r for r in rows if not r['smoke']];groups=[];pairs=[]
 keys=sorted(set((r['suite'],r['domain'],r['scenario'],r['variant']) for r in normal))
 for suite,domain,scenario,variant in keys:
  rs=[r for r in normal if (r['suite'],r['domain'],r['scenario'],r['variant'])==(suite,domain,scenario,variant)]
  groups.append({'suite':suite,'domain':domain,'scenario':scenario,'variant':variant,'count':len(rs),'wallSeconds':stats([r['metrics']['wallSeconds'] for r in rs]),'cpuSeconds':stats([r['metrics']['cpuSeconds'] for r in rs]),'rssMiB':stats([r['metrics']['maxRssKiB']/1024 for r in rs]),'labels':[r['label'] for r in rs]})
 for row in normal:
  if row['variant']=='current':continue
  current=next(r for r in normal if r['variant']=='current' and (r['suite'],r['domain'],r['scenario'],r['pair'])==(row['suite'],row['domain'],row['scenario'],row['pair']))
  assert row['streams']==current['streams'] and row['effect']==current['effect']
  pairs.append({'suite':row['suite'],'domain':row['domain'],'scenario':row['scenario'],'pair':row['pair'],'counterfactual':row['label'],'current':current['label'],'wallPercent':100*(current['metrics']['wallSeconds']/row['metrics']['wallSeconds']-1),'cpuPercent':100*(current['metrics']['cpuSeconds']/row['metrics']['cpuSeconds']-1),'rssPercent':100*(current['metrics']['maxRssKiB']/row['metrics']['maxRssKiB']-1),'outputsAndEffectsEqual':True})
 differences=[]
 for b in groups:
  if b['variant']=='current':continue
  c=next(g for g in groups if g['variant']=='current' and (g['suite'],g['domain'],g['scenario'])==(b['suite'],b['domain'],b['scenario']))
  ps=[p for p in pairs if (p['suite'],p['domain'],p['scenario'])==(b['suite'],b['domain'],b['scenario'])]
  differences.append({'suite':b['suite'],'domain':b['domain'],'scenario':b['scenario'],'counterfactualVariant':b['variant'],'medianChangePercent':{k:100*(c[k]['median']/b[k]['median']-1) for k in ['wallSeconds','cpuSeconds','rssMiB']},'slowerWallPairs':sum(p['wallPercent']>0 for p in ps),'higherCpuPairs':sum(p['cpuPercent']>0 for p in ps),'higherRssPairs':sum(p['rssPercent']>0 for p in ps)})
 return {'groups':groups,'pairs':pairs,'comparisons':differences,'normalCount':len(normal),'smokeCount':len(rows)-len(normal),'failedSamples':[r['label'] for r in rows if r['metrics']['exitCode']!=0 or 'verificationError' in r]}
if __name__=='__main__':
 rows=[json.loads(x) for x in (R/'samples.jsonl').read_text().splitlines()];result=compute(rows)
 (R/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 for c in result['comparisons']:print(c)
 for g in result['groups']:
  if g['variant']=='current':print(g['suite'],g['domain'],g['scenario'],' | '.join(f'{g[k]["median"]:.3f} ({g[k]["min"]:.3f}–{g[k]["max"]:.3f})' for k in ['wallSeconds','cpuSeconds','rssMiB']))

`````

### 首轮与修正轮的实际采集器差异

下列 diff 从实际两个 runner 生成；首轮其余逻辑与上方修正 runner 相同。

`````diff
--- initial/rerun.py
+++ corrected/rerun_corrected.py
@@ -25,17 +25,9 @@
  return {'nodeBunProcesses':rows,'cpuStat':dict(x.split() for x in Path('/sys/fs/cgroup/cpu.stat').read_text().splitlines()),'memoryCurrentBytes':int(Path('/sys/fs/cgroup/memory.current').read_text())}
 def measure(argv,cwd,out,env):
  assert not out.with_suffix('.stdout').exists()
- timed_out=False
- with out.with_suffix('.stdout').open('wb') as stdout,out.with_suffix('.stderr').open('wb') as stderr:
-  started=stamp();start=time.monotonic();p=subprocess.Popen(argv,cwd=cwd,stdout=stdout,stderr=stderr,env=env,start_new_session=True)
-  def expired(*_):
-   nonlocal timed_out
-   timed_out=True;os.killpg(p.pid,signal.SIGKILL)
-  old=signal.signal(signal.SIGALRM,expired);signal.alarm(600)
-  try:_,status,usage=os.wait4(p.pid,0);wall=time.monotonic()-start
-  finally:signal.alarm(0);signal.signal(signal.SIGALRM,old)
-  p.returncode=os.waitstatus_to_exitcode(status)
- return {'startedAt':started,'finishedAt':stamp(),'wallSeconds':wall,'cpuSeconds':usage.ru_utime+usage.ru_stime,'userSeconds':usage.ru_utime,'systemSeconds':usage.ru_stime,'maxRssKiB':usage.ru_maxrss,'exitCode':p.returncode,'timeout':timed_out}
+ subprocess.run([sys.executable,str(R/'methods/measure_cli.py'),str(cwd),str(out),*argv],env=env,check=True)
+ return json.loads(out.with_suffix('.metrics.json').read_text())
+
 def tree(root):
  return {p.relative_to(root).as_posix():{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size,'mode':p.stat().st_mode&0o777} for p in sorted(root.rglob('*')) if p.is_file()}
 def global_verify(root,d):
@@ -88,11 +80,11 @@
  root=global_restore(d,scenario,smoke) if suite=='global' else restore(d,scenario)
  before=tree(root) if suite=='global' else capture(root,d)
  label=f'{suite}-{d}-{scenario}-{pair}-{v}'+('-smoke' if smoke else '')+('-source' if source else '')
- out=R/'logs'/label
+ out=R/'corrected-logs'/label
  args=(['check'] if scenario in ['check','long-check'] else ['sync-index']+(['--preflight'] if scenario=='preflight' else [])) if suite=='global' else (['sync-index','--select',Z] if scenario=='sync-selected' else ['stage',Z,'--scope','index'])
  argv=['node'];env=dict(os.environ)
  if smoke:
-  env['INDEX_COST_CLOSURE']=str(R/'logs'/('closure-'+label+'.jsonl'));argv+=['--import',str(R/'methods/closure.mjs')]
+  env['INDEX_COST_CLOSURE']=str(R/'corrected-logs'/('closure-'+label+'.jsonl'));argv+=['--import',str(R/'methods/closure.mjs')]
  argv +=[str(cli(v,d,source)),*args]
  host_before=host();metrics=measure(argv,root,out,env);host_after=host()
  streams={name:{'bytes':out.with_suffix('.'+name).stat().st_size,'sha256':sha(out.with_suffix('.'+name).read_bytes()),'text':out.with_suffix('.'+name).read_text()} for name in ['stdout','stderr']}
@@ -107,9 +99,9 @@
   else:row['effect']=index_effect(root,d,scenario,before,capture(root,d))
  except Exception as e:
   row['verificationError']=repr(e)
-  with (R/'samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
+  with (R/'corrected-samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
   raise
- with (R/'samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
+ with (R/'corrected-samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
  print(label,round(metrics['wallSeconds'],3),round(metrics['maxRssKiB']/1024,1),flush=True)
  return row
 
@@ -123,17 +115,17 @@
  deps=fingerprint(manifest(R/'current',['node_modules']));assert deps==e['dependencyFingerprint']
  closure=[]
  from urllib.parse import urlparse,unquote
- for p in (R/'logs').glob('closure-*.jsonl'):
+ for p in (R/'corrected-logs').glob('closure-*.jsonl'):
   for line in p.read_text().splitlines():
    url=json.loads(line)['url'];file=Path(unquote(urlparse(url).path)).resolve();assert file.is_relative_to(R),(p,file);closure.append(str(file.relative_to(R)))
- rows=[json.loads(x) for x in (R/'samples.jsonl').read_text().splitlines()]
+ rows=[json.loads(x) for x in (R/'corrected-samples.jsonl').read_text().splitlines()]
  assert len([x for x in rows if not x['smoke']])==63
  for row in rows:
   assert 'verificationError' not in row and row['metrics']['exitCode']==0
   if row['smoke']:continue
   matches=[s for s in rows if s['smoke'] and s['suite']==row['suite'] and s['domain']==row['domain'] and s['scenario']==row['scenario'] and s['variant']==row['variant'] and not s['source']]
   if row['suite']=='index':assert len(matches)==1;equal(row,matches[0])
- save(R/'final-audit.json',{'finishedAt':stamp(),'normalSamples':63,'smokeSamples':len(rows)-63,'failures':0,'timeout':0,'discarded':0,'sourceFingerprintsUnchanged':proof,'dependencyFingerprintUnchanged':deps,'closureFileUrlEvents':len(closure),'closureDistinctPaths':len(set(closure)),'closureAllInsideExperiment':True,'indexNormalSmokeEffectsEqual':True})
+ save(R/'corrected-final-audit.json',{'finishedAt':stamp(),'normalSamples':63,'smokeSamples':len(rows)-63,'failures':0,'timeout':0,'discarded':0,'sourceFingerprintsUnchanged':proof,'dependencyFingerprintUnchanged':deps,'closureFileUrlEvents':len(closure),'closureDistinctPaths':len(set(closure)),'closureAllInsideExperiment':True,'indexNormalSmokeEffectsEqual':True})
 
 if __name__=='__main__':
  mode=sys.argv[1]

`````

### 固定输入模板

索引矩阵的五个原模板逐个取自 Git `563119ef:changes/localize-record-operations/validation/replay-bundle.tar.gz` 的 `methods/input-templates/`；保留如下，便于不展开历史归档即可阅读。全量矩阵由上方 `global_body.py` 生成。

#### decision-candidate.md

`````text
---
title: "benchmark 261001-candidate-1"
id: "261001-candidate-1"
status: "candidate"
alignment: null
createdAt: null
purpose: "固定目的"
background: "固定背景"
decision: "固定决定"
tags:
  - "benchmark"
relations: []
---

## 目的
固定目的。

## 背景
固定背景。

## 决策
- 采用: 固定决定。

`````

#### decision-formal.md

`````text
---
title: "benchmark 261001-record-00001"
id: "261001-record-00001"
status: "archived"
alignment: "unaligned"
createdAt: "2026-10-01T00:00:00Z"
purpose: "固定目的"
background: "固定背景"
decision: "固定决定"
tags:
  - "benchmark"
relations: []
---

## 目的
固定目的。

## 背景
固定背景。

## 决策
- 采用: 固定决定。

`````

#### evidence.txt

`````text
constant resource evidence

`````

#### investigation-candidate.md

`````text
---
title: "benchmark 261001-candidate-1"
id: "261001-candidate-1"
formedAt: "2026-10-01T00:00:00Z"
question: "固定问题"
tags:
  - "benchmark"
relations: []
---

## 形成时背景
固定背景。

## 调查目的
固定目的。

## 调查范围与依据
固定依据。

## 调查结果与边界
固定结果与边界。

`````

#### investigation-formal.md

`````text
---
title: "benchmark 261001-record-00002"
id: "261001-record-00002"
formedAt: "2026-10-01T00:00:00Z"
question: "固定问题"
tags:
  - "benchmark"
relations: []
---

## 形成时背景
固定背景。

## 调查目的
固定目的。

## 调查范围与依据
固定依据。

## 调查结果与边界
固定结果与边界。

`````
