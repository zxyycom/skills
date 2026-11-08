import os,subprocess,json,shutil,collections,pathlib,time,hashlib
P=pathlib.Path('/workspace/skills/dist/record-native-survey-20261108/writes');root=P/'fixture-history-250';base=pathlib.Path('/workspace/skills/dist/record-benchmarks/perf-261107-main/n250');cli='/workspace/skills/dist/record-cli-perf-261107-main/assets/investigation-report';log=P/'history-edges.jsonl';assert not root.exists() and not log.exists();shutil.copytree(base,root)
def git(*a):
 r=subprocess.run(['git',*a],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30);assert not r.returncode,r.stderr;return r.stdout
for a in [('init','-q'),('config','user.name','Fixture'),('config','user.email','fixture@example.invalid'),('config','commit.gpgsign','false'),('add','docs'),('commit','-qm','baseline')]:git(*a)
def idx():return json.loads((root/'docs/investigations/investigation-index.json').read_text())['entries']
def snap():return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'docs/investigations').rglob('*') if p.is_file()}
def run(label,args,trace=None):
 env=os.environ.copy();argv=[cli,*args,'--root',str(root),'--json'];
 if trace:env['GIT_TRACE2_EVENT']=str(P/trace)
 t=time.perf_counter_ns();p=subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,timeout=40);ms=round((time.perf_counter_ns()-t)/1e6,3);o=json.loads(p.stdout);rec={'label':label,'ms':ms,'argv':argv,'exit':p.returncode,'ok':o.get('ok'),'stderr':p.stderr.decode(),'stdout':o,'head':git('rev-parse','HEAD').decode().strip(),'trace':trace};
 with open(log,'a') as f:f.write(json.dumps(rec,ensure_ascii=False)+'\n')
 print(label,ms,p.returncode,o.get('error',''),flush=True);assert p.returncode==0 and o.get('ok');return o
for phase in ('before','after'):
 edges=[r['target'] for s in idx().values() for r in s['relations']];print(phase,'N',len(idx()),'edges',len(edges),'unique',len(set(edges)),'target occurrence',edges.count('260101-record-00026'),flush=True)
 for i in range(2):run(f'{phase}-check-{i+1}',['check'])
 run(f'{phase}-check-trace',['check'],trace=f'history-{phase}.trace.jsonl')
 if phase=='before':
  selected=[f'260101-record-{i:05d}' for i in range(100,132)];before=snap();args=['set-relations']
  for id in selected:args+=['--source',id,'--relation','补充=260101-record-00026']
  run('add-32-same-target',args);after=snap();changed={k for k in before if before[k]!=after.get(k)};expected={f'docs/investigations/{id}.md' for id in selected}|{'docs/investigations/investigation-index.json'};assert changed==expected,(changed^expected);assert all(idx()[id]['relations']==[{'target':'260101-record-00026','type':'补充'}] or idx()[id]['relations']==[{'type':'补充','target':'260101-record-00026'}] for id in selected);git('add','--','docs/investigations');git('commit','-qm','add edges')
  assert not git('status','--short')
