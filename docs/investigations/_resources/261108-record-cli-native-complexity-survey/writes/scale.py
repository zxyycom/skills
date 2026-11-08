import os,subprocess,json,shutil,hashlib,time,pathlib
P=pathlib.Path('/workspace/skills/dist/record-native-survey-20261108/writes');root=P/'fixture-scale-250';source=pathlib.Path('/workspace/skills/dist/record-benchmarks/perf-261107-main/n250');assets=pathlib.Path('/workspace/skills/dist/record-cli-perf-261107-main/assets');log=P/'scale.jsonl';assert not root.exists() and not log.exists();shutil.copytree(source,root)
def git(*a):
 p=subprocess.run(['git',*a],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30);assert not p.returncode,(a,p.stderr);return p.stdout
for a in [('init','-q'),('config','user.name','Fixture'),('config','user.email','fixture@example.invalid'),('config','commit.gpgsign','false'),('config','core.autocrlf','false'),('add','--','docs'),('commit','-qm','baseline')]:git(*a)
(root/'sentinel').write_text('head\n');git('add','sentinel');git('commit','-qm','sentinel');(root/'sentinel').write_text('pending\n');git('add','sentinel');(root/'sentinel').write_text('worktree\n');assert git('show',':sentinel')==b'pending\n'
head=git('rev-parse','HEAD').decode().strip();pending_count=len(git('ls-files','--stage','-z').split(b'\0'))-1
print('N 250 P',pending_count,'HEAD',head,flush=True)
def run(label,d,args,trace=None):
 binary=assets/('decision-records' if d=='d' else 'investigation-report');argv=[str(binary),*args,'--root',str(root),'--json'];env=os.environ.copy()
 if trace:env['GIT_TRACE2_EVENT']=str(P/trace)
 start=time.perf_counter_ns();p=subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=45,env=env);ms=round((time.perf_counter_ns()-start)/1e6,3);o=json.loads(p.stdout);errs=[]
 if p.returncode or not o.get('ok'):errs.append('CLI failed')
 if git('show',':sentinel')!=b'pending\n':errs.append('sentinel changed')
 rec=dict(label=label,argv=argv,ms=ms,exit=p.returncode,stderr=p.stderr.decode(),stdout=o,errors=errs,trace=trace,pending_count=pending_count,head=head)
 with open(log,'a') as f:f.write(json.dumps(rec,ensure_ascii=False)+'\n')
 print(label,ms,'ms',errs,flush=True);return rec
# Same fixed graph/HEAD, independent normal and trace counter run; trace time is not performance.
run('i-check-250','i',['check']);run('i-check-250-trace','i',['check'],trace='ir-check-250.trace.jsonl')
for d,folder in [('d','decisions'),('i','investigations')]:
 for k,start in [(1,40),(8,50),(32,75)]:
  ids=[f'260101-record-{i:05d}' for i in range(start,start+k)]
  paths=[root/'docs'/folder/f'{id}.md' for id in ids]
  assert all(p.exists() for p in paths)
  for p in paths:p.write_text(p.read_text()+'\nScale-stage-selected.\n')
  sync=['sync-index'];[sync.extend(['--select',i]) for i in ids];run(f'{d}-sync-k{k}',d,sync)
  result=run(f'{d}-stage-k{k}',d,['stage',*ids,'--scope','all'])
  mismatches=[]
  for p in paths:
   if git('show',':'+str(p.relative_to(root)))!=p.read_bytes():mismatches.append(str(p))
  if git('show',':sentinel')!=b'pending\n':mismatches.append('sentinel')
  with open(log,'a') as f:f.write(json.dumps({'label':f'{d}-stage-k{k}-postcheck','selected_count':k,'mismatches':mismatches})+'\n')
  print(d,'K',k,'postcheck',mismatches or 'OK',flush=True)
 # Instrument no-op K=8 from earlier selected group, separate from wall.
 ids=[f'260101-record-{i:05d}' for i in range(50,58)]
 run(f'{d}-stage-k8-trace',''+d,['stage',*ids,'--scope','all'],trace=f'{d}-stage-k8.trace.jsonl')
print('FINISHED scale')
