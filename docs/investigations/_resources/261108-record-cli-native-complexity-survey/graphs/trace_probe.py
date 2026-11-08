import os,json,hashlib,time,subprocess,pathlib
P=pathlib.Path('/workspace/skills'); out=P/'dist/record-native-survey-20261108/graphs'; base=P/'dist/record-benchmarks/perf-261107-main'; assets=P/'dist/record-cli-perf-261107-main/assets'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def id(i): return f'260101-record-{i:05}'
def check(t,tr,ctx,complete,stop,front,blocked):
 assert t['traceIds']==list(map(id,tr)),('trace',t['traceIds'],tr)
 assert t['contextIds']==list(map(id,ctx)),('context',t['contextIds'],ctx)
 assert t['coverage']=={'complete':complete,'stoppedBy':stop},t['coverage']
 assert t['frontier']==front,('frontier',t['frontier'],front)
 assert t.get('blockedEvent')==blocked,('blocked',t.get('blockedEvent'),blocked)
def front(a,d,r,ns): return [{'fromId':id(a),'direction':d,'reason':r,'nextIds':list(map(id,ns))}]
def blocked(kind,ids,required): return {'kind':kind,'recordIds':list(map(id,ids)),'requiredMaxRecords':required}
outputs=[]; guards={}
for domain,exe in [('decisions','decision-records'),('investigations','investigation-report')]:
 for fixture in ['n32','width40','width200']:
  root=base/fixture; shape=json.loads((root/'fixture.json').read_text()); n,w,depth=shape['count'],shape['width'],shape['depth']; idx=root/'docs'/domain/('decision-index.json' if domain=='decisions' else 'investigation-index.json'); guards[str(idx)]=sha(idx); guards[str(assets/exe)]=sha(assets/exe)
  eids=[5,6,7,8] if domain=='decisions' else [5,6,7]; etype='reallocation' if domain=='decisions' else 'merge'; ctx=[6,8] if domain=='decisions' else [6]
  cases=[('split-block',0,'successors','2',2,([0],[],False,['max-records'],front(0,'successors','max-records',[1,2]),blocked('split',[0,1,2],3))),('event-block',5,'successors','all',2,([5],[],False,['max-records'],front(5,'successors','max-records',[7]),blocked(etype,eids,len(eids)))),('event-context',5,'successors','1',4,([5,7],ctx,True,[],[],None)),('chain-depth',1,'successors','1',20,([1,3],[],False,['depth'],front(3,'successors','depth',[4]),None)),('wide-merge',9+w+depth,'predecessors','all',w+depth+2,(list(range(9,10+w+depth)),[],True,[],[],None))]
  for name,anchor,direction,dep,budget,expected in cases:
   args=[str(assets/exe),'trace',id(anchor),'--direction',direction,'--depth',dep,'--max-records',str(budget),'--json','--root',str(root)]
   for rep in range(3 if fixture=='n32' else 1):
    t=time.perf_counter(); p=subprocess.run(args,capture_output=True,timeout=30); ms=(time.perf_counter()-t)*1000
    row=dict(domain=domain,fixture=fixture,case=name,N=n,width=w,depth=depth,argv=args,elapsed_ms=round(ms,3),returncode=p.returncode,stdout_bytes=len(p.stdout),stderr_bytes=len(p.stderr),stdout_sha=hashlib.sha256(p.stdout).hexdigest(),stderr=p.stderr.decode(errors='replace')[:1000]); outputs.append(row)
    try:
     assert p.returncode==0,(p.returncode,p.stderr); data=json.loads(p.stdout); check(data,*expected); row['expected']='pass'
    except Exception as e:
     row['expected']='FAIL '+str(e); (out/'trace_failure.json').write_text(json.dumps({'row':row,'stdout':p.stdout.decode(errors='replace')},ensure_ascii=False,indent=2)); raise
with (out/'trace_results.jsonl').open('w') as f:
 for row in outputs:f.write(json.dumps(row,ensure_ascii=False)+'\n')
for k,v in guards.items(): assert sha(pathlib.Path(k))==v, k
(out/'trace_guards.json').write_text(json.dumps(guards,indent=2)+'\n')
print('PASS',len(outputs),'runs; full output trace_results.jsonl')
