import pathlib,subprocess,json,time,hashlib,re
P=pathlib.Path('/workspace/skills');out=P/'dist/record-native-survey-20261108/graphs'; assets=P/'dist/record-cli-perf-261107-main/assets'; root=out/'ordinary-decision-50';root.mkdir();d=root/'docs/decisions';(d/'archive').mkdir(parents=True)
src=out/'realloc-50/docs/decisions'; anchor='260101-prev-00000'; children=[f'260101-next-{i:05}' for i in range(50)]
for f in src.glob('*.md'):
 text=f.read_text(); text=re.sub(r'relations:\n(?:  - type: "重划"\n    target: "[^\n]+"\n)+',f'relations:\n  - type: "修订"\n    target: "{anchor}"\n',text); (d/f.name).write_text(text)
for f in (src/'archive').glob('*.md'):(d/'archive'/f.name).write_bytes(f.read_bytes())
rows=[]
def run(exe,root,args):
 cmd=[str(assets/exe),*args,'--json','--root',str(root)];t=time.perf_counter();r=subprocess.run(cmd,capture_output=True,timeout=60);row={'argv':cmd,'elapsed_ms':round((time.perf_counter()-t)*1000,3),'exit':r.returncode,'stdout_bytes':len(r.stdout),'stdout_sha':hashlib.sha256(r.stdout).hexdigest(),'stderr':r.stderr.decode(errors='replace')};rows.append(row)
 try: assert r.returncode==0,(r.returncode,r.stdout,r.stderr);return json.loads(r.stdout)
 except Exception as e:(out/'ordinary-failure.json').write_text(json.dumps({'row':row,'stdout':r.stdout.decode(errors='replace'),'error':str(e)},ensure_ascii=False,indent=2));raise
run('decision-records',root,['sync-index']);run('decision-records',root,['check']);
for domain,exe,r,a,ch in [('DR','decision-records',root,anchor,children),('IR','investigation-report',P/'dist/record-benchmarks/perf-261107-main/width40','260101-record-00058',[f'260101-record-{i:05}' for i in range(59,99)])]:
 result=run(exe,r,['trace',a,'--direction','successors','--depth','all','--max-records','2']);assert result['traceIds']==sorted([a,ch[0]]) and result['contextIds']==[] and result['coverage']=={'complete':False,'stoppedBy':['max-records']} and result['frontier']==[{'fromId':a,'direction':'successors','reason':'max-records','nextIds':ch[1:]}] and 'blockedEvent' not in result,result
 result=run(exe,r,['list','--related-to',a,'--direction','successors','--limit','1']+(['--status','all'] if domain=='DR' else [])); assert result['ok'] and result['result']['total']==len(ch),result
 idx=r/'docs'/('decisions/decision-index.json' if domain=='DR' else 'investigations/investigation-index.json');rows.append({'domain':domain,'index':str(idx),'index_bytes':idx.stat().st_size,'index_sha':hashlib.sha256(idx.read_bytes()).hexdigest(),'nodes':100 if domain=='DR' else 250,'direct_degree':len(ch)})
(out/'ordinary-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));print('PASS ordinary, filter and frontier both domains')
