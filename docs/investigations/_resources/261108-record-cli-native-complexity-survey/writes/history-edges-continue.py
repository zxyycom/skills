import os,subprocess,json,shutil,collections,pathlib,time,hashlib
P=pathlib.Path('/workspace/skills/dist/record-native-survey-20261108/writes');root=P/'fixture-history-250';base=pathlib.Path('/workspace/skills/dist/record-benchmarks/perf-261107-main/n250');cli='/workspace/skills/dist/record-cli-perf-261107-main/assets/investigation-report';log=P/'history-edges.jsonl';assert root.exists() and log.exists()
def git(*a):
 r=subprocess.run(['git',*a],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30);assert not r.returncode,r.stderr;return r.stdout
def idx():return json.loads((root/'docs/investigations/investigation-index.json').read_text())['entries']
def snap():return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'docs/investigations').rglob('*') if p.is_file()}
def run(label,args,trace=None):
 env=os.environ.copy();argv=[cli,*args,'--root',str(root),'--json'];
 if trace:env['GIT_TRACE2_EVENT']=str(P/trace)
 t=time.perf_counter_ns();p=subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,timeout=40);ms=round((time.perf_counter_ns()-t)/1e6,3);o=json.loads(p.stdout);rec={'label':label,'ms':ms,'argv':argv,'exit':p.returncode,'ok':o.get('ok'),'stderr':p.stderr.decode(),'stdout':o,'head':git('rev-parse','HEAD').decode().strip(),'trace':trace};
 with open(log,'a') as f:f.write(json.dumps(rec,ensure_ascii=False)+'\n')
 print(label,ms,p.returncode,o.get('error',''),flush=True);assert p.returncode==0 and o.get('ok');return o
phase='after'
edges=[r['target'] for st in idx().values() for r in st['relations']];print(phase,'N',len(idx()),'edges',len(edges),'unique',len(set(edges)),'target occurrence',edges.count('260101-record-00026'),flush=True)
for i in range(2):run(f'{phase}-check-{i+1}',['check'])
run(f'{phase}-check-trace',['check'],trace='history-after.trace.jsonl')
