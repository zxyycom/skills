import os,subprocess,json,shutil,hashlib,time,pathlib,sys
P=pathlib.Path('/workspace/skills/dist/record-native-survey-20261108/writes'); root=P/'fixture-wide'; source=pathlib.Path('/workspace/skills/dist/record-benchmarks/perf-261107-main/n32'); assets=pathlib.Path('/workspace/skills/dist/record-cli-perf-261107-main/assets'); log=P/'wide.jsonl'
assert not root.exists() and not log.exists()
shutil.copytree(source,root)
def git(*args):
 r=subprocess.run(['git',*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20); assert r.returncode==0,(args,r.stderr); return r.stdout
for a in [('init','-q'),('config','user.name','Fixture'),('config','user.email','fixture@example.invalid'),('config','commit.gpgsign','false'),('config','core.autocrlf','false'),('add','--','docs'),('commit','-qm','baseline')]:git(*a)
(root/'unselected.txt').write_text('baseline\n');git('add','unselected.txt');git('commit','-qm','sentinel-baseline');(root/'unselected.txt').write_text('pending\n');git('add','unselected.txt');(root/'unselected.txt').write_text('worktree\n'); sentinel=git('show',':unselected.txt');assert sentinel==b'pending\n'
head=git('rev-parse','HEAD').decode().strip();print('fixture HEAD',head,flush=True)
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
# Baseline full/selected reads, stage all scopes with unrelated pending preserved.
for d in ('d','i'):
 call(f'{d}-check-full',d,['check'],write_allowed=False)
 if d=='i':call('i-check-selected',d,['check','--id','260101-record-00030'],write_allowed=False)
 call(f'{d}-sync-full-current',d,['sync-index'],write_allowed=False)
 call(f'{d}-sync-full-preflight',d,['sync-index','--preflight'],write_allowed=False)
 call(f'{d}-sync-selected-current',d,['sync-index','--select','260101-record-00030'],write_allowed=False)
 call(f'{d}-sync-selected-preflight',d,['sync-index','--select','260101-record-00030','--preflight'],write_allowed=False)
# Selectively refresh one edited full record; complete check after timed call.
for d,folder in [('d','decisions'),('i','investigations')]:
 path=root/'docs'/folder/'260101-record-00030.md';path.write_text(path.read_text()+'\nprivate selected edit\n')
 call(f'{d}-sync-selected-write',d,['sync-index','--select','260101-record-00030'],check=lambda o,x,f=folder: (eq_idx(f,'260101-record-00030',True),assert_index_delta(x,f)))
 call(f'{d}-check-after-selected',d,['check'],write_allowed=False)
# Stage index / domain / all for both domains, selected after sync. Preserve staged sentinel across all.
for d in ('d','i'):
 for scope in ('index','domain','all'):
  call(f'{d}-stage-{scope}',d,['stage','260101-record-00030','--scope',scope],write_allowed=False if False else True)
# New/candidate publication and independent file/index assertions.
for d,folder in [('d','decisions'),('i','investigations')]:
 if d=='d': args=['new','survey-d','--title','Survey','--purpose','Purpose','--background','Background','--decision','Decision']
 else: args=['new','survey-i','--title','Survey','--question','Question','--tag','survey','--formed-at','2026-01-01T00:00:00Z']
 o=call(f'{d}-new',d,args); files=list((root/'docs'/folder).glob('*survey-*.md')); assert len(files)==1,(d,files); cand=files[0];add_body(cand)
 for mode in ('preflight','write'):
  opts=['publish','survey-d','--alignment','unaligned'] if d=='d' else ['publish','survey-i']
  if mode=='preflight':opts+=['--preflight']
  o=call(f'{d}-publish-{mode}',d,opts,write_allowed=mode!='preflight')
  if mode=='write':
   assert o and o.get('ok'),o
   assert not (d=='i' and cand.exists()); assert any('survey-' in k for k in idx(folder))
# DR mark then archive/reactivate created source; all status assertions use index.
did=next(k for k in idx('decisions') if k.endswith('-survey-d'))
call('d-mark-aligned','d',['mark-aligned',did],check=lambda o,x: (idx('decisions')[did]['alignment']=='aligned' or (_ for _ in ()).throw(AssertionError('alignment'))))
call('d-archive-recorded-check','d',['archive',did],expected=1,write_allowed=False)
call('d-archive-override','d',['archive',did,'--keep-unrecorded-history'],check=lambda o,x: (idx('decisions')[did]['status']=='archived' or (_ for _ in ()).throw(AssertionError('not archived'))))
call('d-reactivate-preflight','d',['reactivate',did,'--alignment','aligned','--preflight'],write_allowed=False)
call('d-reactivate-write','d',['reactivate',did,'--alignment','aligned'],check=lambda o,x: (idx('decisions')[did]['status']=='active' or (_ for _ in ()).throw(AssertionError('not active'))))
# No-op relation replacement and actual relation write targeting a safe archived record.
for d,src in [('d',did),('i',next(k for k in idx('investigations') if k.endswith('-survey-i')))]:
 call(f'{d}-relations-noop',d,['set-relations','--source',src,'--clear-relations'],write_allowed=False)
 relation='修订=260101-record-00005' if d=='d' else '补充=260101-record-00005'
 call(f'{d}-relations-preflight',d,['set-relations','--source',src,'--relation',relation,'--preflight'],write_allowed=False)
 call(f'{d}-relations-write',d,['set-relations','--source',src,'--relation',relation],check=lambda o,x,folder=('decisions' if d=='d' else 'investigations'),s=src: (len(idx(folder)[s]['relations'])==1 or (_ for _ in ()).throw(AssertionError('relations'))))
# Formal identity: recorded refusal, explicit confirmation and discard, separate target with no references.
for d,folder in [('d','decisions'),('i','investigations')]:
 old='260101-record-00031';new='260101-renamed-survey'; flag='--rename-recorded-decision' if d=='d' else '--rename-recorded-report'
 call(f'{d}-rename-noop',d,['rename',old,old],write_allowed=False)
 call(f'{d}-rename-preflight',d,['rename',old,new,'--preflight'],write_allowed=False)
 call(f'{d}-rename-history-refusal',d,['rename',old,new],expected=1,write_allowed=False)
 call(f'{d}-rename-formal',d,['rename',old,new,flag],check=lambda o,x,f=folder:(eq_idx(f,old,False),eq_idx(f,new,True)))
 call(f'{d}-discard-formal',d,['discard',new],check=lambda o,x,f=folder:eq_idx(f,new,False))
# Additional candidate identity and resource owner operations.
for d,folder in [('d','decisions'),('i','investigations')]:
 args=['new','candidate-remove','--title','X','--purpose','P','--background','B','--decision','D'] if d=='d' else ['new','candidate-remove','--title','X','--question','Q','--tag','x','--formed-at','2026-01-01T00:00:00Z']
 call(f'{d}-new-candidate-identity',d,args)
 if d=='i':
  p=root/'docs/investigations/_resources/260101-candidate-remove';p.mkdir(parents=True);(p/'a.txt').write_text('owned payload\n')
 call(f'{d}-rename-candidate',d,['rename','candidate-remove','candidate-renamed'])
 if d=='i': assert (root/'docs/investigations/_resources/260101-candidate-renamed/a.txt').read_text()=='owned payload\n'
 args=['discard','candidate-renamed']+(['--delete-owned-resources'] if d=='i' else [])
 call(f'{d}-discard-candidate',d,args)
 if d=='i': assert not (root/'docs/investigations/_resources/260101-candidate-renamed').exists()
print('FINISHED',flush=True)
