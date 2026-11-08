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

# Reset only the private fixture's selected decision pending entries; preserve unrelated sentinel.
git('restore','--staged','--','docs/decisions'); assert git('show',':unselected.txt')==sentinel
old='260101-record-00031';new='260101-renamed-survey'
call('d-rename-preflight-clean','d',['rename',old,new,'--preflight'],write_allowed=False)
call('d-rename-recorded-refusal','d',['rename',old,new],expected=1,write_allowed=False)
call('d-rename-formal-clean','d',['rename',old,new,'--rename-recorded-decision'],check=lambda o,x:(eq_idx('decisions',old,False),eq_idx('decisions',new,True)))
call('d-discard-formal-clean','d',['discard',new],check=lambda o,x:eq_idx('decisions',new,False))
call('d-new-candidate-corrected','d',['new','candidate-remove','--title','Candidate test','--purpose','Purpose','--background','Background','--decision','Decision','--tag','survey'])
call('d-rename-candidate-corrected','d',['rename','candidate-remove','candidate-renamed'])
call('d-discard-candidate-corrected','d',['discard','candidate-renamed'])
# One independent candidate no-op to establish actual no-op path; evolved candidate is separate.
for d,folder in [('d','decisions'),('i','investigations')]:
 args=['new','noop-test','--title','Noop test','--purpose','Purpose','--background','Background','--decision','Decision','--tag','survey'] if d=='d' else ['new','noop-test','--title','Noop test','--question','Question','--tag','survey','--formed-at','2026-01-01T00:00:00Z']
 o=call(f'{d}-new-noop',d,args); ident=o['result'].get('id',o['result'].get('decisionId')); print('noop identity',ident,flush=True)
 call(f'{d}-rename-candidate-noop',d,['rename',ident,ident],write_allowed=False)
# Full sync changed: edit second independent source; compare full index changes and check afterwards.
for d,folder in [('d','decisions'),('i','investigations')]:
 path=root/'docs'/folder/'260101-record-00029.md';path.write_text(path.read_text()+'\nFull sync observation.\n')
 call(f'{d}-sync-full-write',d,['sync-index'],check=lambda o,x,f=folder:assert_index_delta(x,f))
 call(f'{d}-check-after-full',d,['check'],write_allowed=False)
# Evolution creates a candidate successor; no predecessor needed for minimum valid lifecycle event.
o=call('d-new-evolve','d',['new','evolve-survey','--title','Evolution test','--purpose','Purpose','--background','Background','--decision','Decision','--tag','survey'])
cand=root/'docs/decisions'/o['result']['sourcePath']; add_body(cand)
call('d-evolve-preflight','d',['evolve','--successor','aligned=evolve-survey','--preflight'],write_allowed=False)
call('d-evolve-write','d',['evolve','--successor','aligned=evolve-survey'],check=lambda o,x: (any(k.endswith('-evolve-survey') for k in idx('decisions')) or (_ for _ in ()).throw(AssertionError('not published'))))
# Three stage scopes with independent checks: selected index and selected source pending.
for d,folder in [('d','decisions'),('i','investigations')]:
 src=f'docs/{folder}/260101-record-00028.md'; index=f'docs/{folder}/{"decision" if d=="d" else "investigation"}-index.json'
 for scope in ('index','domain','all'):
  p=root/src;p.write_text(p.read_text()+f'\nStage observation {scope}.\n')
  call(f'{d}-stage-{scope}-prepare-sync',d,['sync-index','--select','260101-record-00028'])
  old_pending_source=git('show',':'+src);old_pending_index=git('show',':'+index)
  o=call(f'{d}-stage-{scope}-verified',d,['stage','260101-record-00028','--scope',scope])
  new_pending_source=git('show',':'+src);new_pending_index=git('show',':'+index)
  problems=[]
  if not o or not o.get('ok'):problems.append('stage failed')
  if scope=='index' and new_pending_source!=old_pending_source:problems.append('index scope changed source')
  if scope=='domain' and new_pending_index!=old_pending_index:problems.append('domain scope changed index')
  if scope in ('domain','all') and new_pending_source!=p.read_bytes():problems.append('source not staged exactly')
  if scope in ('index','all'):
   pj=json.loads(new_pending_index);wj=json.loads((root/index).read_bytes()); id='260101-record-00028'
   if pj['entries'][id]!=wj['entries'][id] or pj['sourceRevision']['entries'][id]!=wj['sourceRevision']['entries'][id]:problems.append('selected index differs')
  if git('show',':unselected.txt')!=sentinel:problems.append('unselected sentinel changed')
  with open(log,'a') as f:f.write(json.dumps({'label':f'{d}-stage-{scope}-independent-assertions','problems':problems,'selected_source_before_sha':hashlib.sha256(old_pending_source).hexdigest(),'selected_source_after_sha':hashlib.sha256(new_pending_source).hexdigest(),'selected_index_before_sha':hashlib.sha256(old_pending_index).hexdigest(),'selected_index_after_sha':hashlib.sha256(new_pending_index).hexdigest(),'sentinel_sha':hashlib.sha256(sentinel).hexdigest()})+'\n')
  print(f'{d}-stage-{scope}-independent',problems or 'OK',flush=True)
print('SUPPLEMENT FINISHED',flush=True)
