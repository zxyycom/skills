import pathlib,subprocess,time,json,hashlib,os,sys
P=pathlib.Path('/workspace/skills'); out=P/'dist/record-native-survey-20261108/graphs'; exe=P/'dist/record-cli-perf-261107-main/assets/investigation-report'; template=P/'dist/record-benchmarks/perf-261107-main/n32/docs/investigations/260101-record-00000.md'; ID='260101-record-00000'; n=int(sys.argv[1]); root=out/f'resource-{n}'; root.mkdir(); d=root/'docs/investigations'; d.mkdir(parents=True); res=d/'_resources'/ID; res.mkdir(parents=True); start=time.perf_counter()
lines=[]
for i in range(n):
 name=f'file-{i:05}.txt'; (res/name).write_text('x\n'); lines.append(f'- [item](./_resources/{ID}/{name})')
text=template.read_text()+ ('\n## 随附资源\n\n'+'\n'.join(lines)+'\n' if lines else ''); (d/f'{ID}.md').write_text(text); creation=time.perf_counter()-start
r=subprocess.run(['git','init','-q',str(root)],capture_output=True,text=True); assert r.returncode==0,r.stderr
rows=[]
def run(args,repeat=1,timeout=60):
 for rep in range(repeat):
  cmd=[str(exe),*args,'--json','--root',str(root)]; before=time.perf_counter(); p=subprocess.run(cmd,capture_output=True,timeout=timeout); dt=time.perf_counter()-before
  row={'resource_count':n,'argv':cmd,'elapsed_ms':round(dt*1000,3),'stdout_bytes':len(p.stdout),'stderr_bytes':len(p.stderr),'stdout_sha':hashlib.sha256(p.stdout).hexdigest(),'exit':p.returncode,'stderr':p.stderr.decode(errors='replace')[:2000]}; rows.append(row)
  try:
   assert p.returncode==0,(p.returncode,p.stdout,p.stderr); o=json.loads(p.stdout); assert o.get('ok',o.get('status')=='ok'),o
   if args[0]=='trace':
    assert o['traceIds']==[ID] and o['contextIds']==[] and o['frontier']==[] and o['coverage']=={'complete':True,'stoppedBy':[]} and 'blockedEvent' not in o, o
   if args[0]=='list': assert o['result']['total']==0,o
  except Exception as e:
   (out/f'resource-{n}-failure.json').write_text(json.dumps({'error':str(e),'row':row,'stdout':p.stdout.decode(errors='replace')},ensure_ascii=False,indent=2)); raise
run(['sync-index']);run(['check']); idx=d/'investigation-index.json'; before=hashlib.sha256(idx.read_bytes()).hexdigest(); print('created and validated',n,'creation_s',round(creation,3),'index_bytes',idx.stat().st_size,flush=True)
run(['trace',ID,'--direction','both','--depth','all','--max-records','1'],3 if n<=500 else 1)
run(['list','--related-to',ID,'--limit','1'],3 if n<=500 else 1)
run(['list','--tag','nonexistent','--limit','1'],3 if n<=500 else 1)
assert hashlib.sha256(idx.read_bytes()).hexdigest()==before
(out/f'resource-{n}-results.json').write_text(json.dumps({'creation_seconds':creation,'index_bytes':idx.stat().st_size,'index_sha256':before,'source_bytes':len(text.encode()),'asset_sha256':hashlib.sha256(exe.read_bytes()).hexdigest(),'rows':rows},ensure_ascii=False,indent=2))
