import os,subprocess,json,shutil,hashlib,time,pathlib,sys
P=pathlib.Path('/workspace/skills/dist/record-native-survey-20261108/writes'); root=P/'fixture-wide'; source=pathlib.Path('/workspace/skills/dist/record-benchmarks/perf-261107-main/n32'); assets=pathlib.Path('/workspace/skills/dist/record-cli-perf-261107-main/assets'); log=P/'wide.jsonl'
assert root.exists() and log.exists()
def git(*args):
 r=subprocess.run(['git',*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20); assert r.returncode==0,(args,r.stderr); return r.stdout
sentinel=git('show',':unselected.txt'); assert sentinel==b'pending\n'
def snapshot():
 out={}
 for p in (root/'docs').rglob('*'):
  if p.is_file():out[str(p.relative_to(root))]=hashlib.sha256(p.read_bytes()).hexdigest()
 return out
def idx(domain):
 return json.loads((root/f'docs/{domain}/{"decision" if domain=="decisions" else "investigation"}-index.json').read_text())['entries']
def call(label,dom,args,expected=0,check=None,write_allowed=True):
 binary=assets/('decision-records' if dom=='d' else 'investigation-report');argv=[str(binary),*args,'--root',str(root),'--json'];before=snapshot();pending=git('ls-files','--stage','-z');t=time.perf_counter_ns()
 try:r=subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
 except subprocess.TimeoutExpired as e:
  with open(log,'a') as f:f.write(json.dumps(dict(label=label,argv=argv,timeout=True))+'\n')
  print('TIMEOUT',label,flush=True);return None
 elapsed=(time.perf_counter_ns()-t)/1e6;after=snapshot();pending_after=git('ls-files','--stage','-z');delta={p:('added' if p not in before else 'deleted' if p not in after else 'modified') for p in sorted(set(before)|set(after)) if before.get(p)!=after.get(p)}
 try: obj=json.loads(r.stdout)
 except:obj={'malformed_stdout':r.stdout.decode(errors='replace')}
 errors=[]
 if r.returncode!=expected:errors.append('exit expected %s got %s'%(expected,r.returncode))
 if r.returncode==0 and obj.get('ok') is not True:errors.append('missing ok true')
 if git('show',':unselected.txt')!=sentinel:errors.append('sentinel pending changed')
 if not write_allowed and (delta or pending!=pending_after):errors.append('expected no writes')
 if check:
  try:check(obj,delta)
  except Exception as e:errors.append(repr(e))
 record=dict(label=label,argv=argv,elapsed_ms=round(elapsed,3),exit=r.returncode,stdout=obj,stderr=r.stderr.decode(errors='replace'),delta=delta,pending_changed=pending!=pending_after,sentinel_preserved=True,errors=errors)
 with open(log,'a') as f:f.write(json.dumps(record,ensure_ascii=False)+'\n')
 print(label,round(elapsed,2),'ms', 'OK' if not errors else 'FAIL '+str(errors),json.dumps(obj.get('error',{}),ensure_ascii=False),flush=True)
 return obj
D='docs/decisions/';I='docs/investigations/'
def eq_idx(dom,id,present): assert (id in idx(dom))==present,(dom,id,present)
def assert_index_delta(delta, folder):
 assert any(k == f'docs/{folder}/{"decision" if folder=="decisions" else "investigation"}-index.json' for k in delta), delta
def add_body(path):
 text=path.read_text(); text=text.replace('## 目的\n\n','## 目的\n\nPurpose.\n\n').replace('## 背景\n\n','## 背景\n\nBackground.\n\n').replace('## 决策\n','## 决策\n\n- 采用: Decision.\n').replace('## 形成时背景\n\n','## 形成时背景\n\nBackground.\n\n').replace('## 调查目的\n\n','## 调查目的\n\nPurpose.\n\n').replace('## 调查范围与依据\n\n','## 调查范围与依据\n\nEvidence.\n\n').replace('## 调查结果与边界\n','## 调查结果与边界\n\nResults.\n');path.write_text(text)

# The earlier same-ID rename normalized sourcePath; now both ID and path match allocation.
for d in ('d','i'):
 call(f'{d}-rename-true-noop',d,['rename','noop-test','noop-test'],write_allowed=False,check=lambda o,x:(o['result']['noChange'] is True or (_ for _ in ()).throw(AssertionError('noChange false'))))
# Resource stage: selected owner and unselected staged owner have distinct bytes.
base=root/'docs/investigations/_resources';selected=base/'260101-record-00028/selected.bin';other=base/'260101-record-00027/unselected.bin';selected.parent.mkdir(parents=True,exist_ok=True);other.parent.mkdir(parents=True,exist_ok=True);selected.write_bytes(b'selected-stage-payload\n');other.write_bytes(b'unselected-pending\n');git('add','--',str(other.relative_to(root)));other.write_bytes(b'unselected-worktree\n')
obj=call('i-stage-domain-owner','i',['stage','260101-record-00028','--scope','domain']); problems=[]
if not obj or not obj.get('ok'): problems.append('stage failed')
if git('show',':'+str(selected.relative_to(root)))!=selected.read_bytes(): problems.append('owner bytes not staged')
if git('show',':'+str(other.relative_to(root)))!=b'unselected-pending\n': problems.append('unselected owner changed')
if git('show',':unselected.txt')!=sentinel: problems.append('sentinel changed')
with open(log,'a') as f:f.write(json.dumps({'label':'i-stage-domain-owner-independent','problems':problems,'selected_bytes':selected.stat().st_size,'unselected_pending_bytes':len(b'unselected-pending\n')})+'\n')
print('i-stage-domain-owner-independent',problems or 'OK',flush=True)
