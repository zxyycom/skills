import pathlib,subprocess,time,json,hashlib,sys
P=pathlib.Path('/workspace/skills');out=P/'dist/record-native-survey-20261108/graphs';exe=P/'dist/record-cli-perf-261107-main/assets/decision-records';k=int(sys.argv[1]);root=out/f'realloc-{k}';root.mkdir();d=root/'docs/decisions';a=d/'archive';a.mkdir(parents=True);p=lambda i:f'260101-prev-{i:05}'; s=lambda i:f'260101-next-{i:05}'
start=time.perf_counter()
for kind in ['prev','next']:
 for i in range(k):
  ID=p(i) if kind=='prev' else s(i); targets=sorted([p(i),p((i+1)%k)]) if kind=='next' else []
  rel='relations: []' if not targets else 'relations:\n'+''.join(f'  - type: "重划"\n    target: "{v}"\n' for v in targets).rstrip()
  text=f'''---\ntitle: "Benchmark {ID}"\nid: "{ID}"\nstatus: {'archived' if kind=='prev' else 'active'}\nalignment: aligned\ncreatedAt: "2026-01-01T00:00:00Z"\npurpose: "Benchmark purpose"\nbackground: "Benchmark background"\ndecision: "Benchmark decision"\ntags:\n  - "benchmark"\n{rel}\n---\n\n## 目的\n\nBenchmark purpose.\n\n## 背景\n\nBenchmark background.\n\n## 决策\n\n- 采用: Benchmark decision.\n'''; ((a if kind=='prev' else d)/f'{ID}.md').write_text(text)
creation=time.perf_counter()-start; rows=[]
def run(args):
 cmd=[str(exe),*args,'--json','--root',str(root)];t=time.perf_counter();r=subprocess.run(cmd,capture_output=True,timeout=60);ms=(time.perf_counter()-t)*1000
 row={'argv':cmd,'elapsed_ms':round(ms,3),'exit':r.returncode,'stdout_bytes':len(r.stdout),'stderr':r.stderr.decode(errors='replace')[:1000], 'stdout_sha':hashlib.sha256(r.stdout).hexdigest()};rows.append(row)
 try:
  assert r.returncode==0,(r.returncode,r.stdout,r.stderr);o=json.loads(r.stdout); assert o.get('ok',o.get('status')=='ok'),o
 except Exception as e:
  (out/f'realloc-{k}-failure.json').write_text(json.dumps({'row':row,'stdout':r.stdout.decode(errors='replace'),'exception':str(e)},ensure_ascii=False,indent=2));raise
 return o
run(['sync-index']);run(['check']); anchor=p(0); direct=sorted([s(0),s(k-1)]); members=sorted([p(i) for i in range(k)]+[s(i) for i in range(k)])
a=run(['trace',anchor,'--direction','successors','--depth','1','--max-records',str(2*k-1)]); assert a['traceIds']==[anchor] and a['contextIds']==[] and a['blockedEvent']=={'kind':'reallocation','recordIds':members,'requiredMaxRecords':2*k} and a['frontier']==[{'fromId':anchor,'direction':'successors','reason':'max-records','nextIds':direct}] and a['coverage']=={'complete':False,'stoppedBy':['max-records']},a
b=run(['trace',anchor,'--direction','successors','--depth','1','--max-records',str(2*k)]); assert b['traceIds']==sorted([anchor]+direct) and b['contextIds']==[m for m in members if m not in [anchor]+direct] and b['frontier']==[] and 'blockedEvent' not in b and b['coverage']=={'complete':True,'stoppedBy':[]},b
idx=d/'decision-index.json'; result={'nodes':2*k,'edges':2*k,'creation_seconds':creation,'source_bytes':sum(x.stat().st_size for x in d.rglob('*.md')),'index_bytes':idx.stat().st_size,'index_sha':hashlib.sha256(idx.read_bytes()).hexdigest(),'asset_sha':hashlib.sha256(exe.read_bytes()).hexdigest(),'rows':rows}; (out/f'realloc-{k}-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('PASS',k,result['index_bytes'],[(x['argv'][1],x['elapsed_ms']) for x in rows],flush=True)
