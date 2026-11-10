"""Private Linux diagnostic, not the unknown Windows workload or a production test."""
import collections, datetime, hashlib, json, os, pathlib, platform, random, statistics, subprocess, sys, time
BASE=pathlib.Path(__file__).resolve().parent
REPO=BASE.parents[2]
RECEIPT=json.loads((REPO/'.local/record-cli/receipt.json').read_text())
NATIVE=REPO/'.local/record-cli'/RECEIPT['generation']/'investigation-report'
OLD=BASE/'old-cli/skills/investigation-report/scripts/check-investigations.ts'
PROBE=REPO/'dist/record-cli-check-diagnosis-261110/probe-target/release/investigation-report'
ENV=dict(os.environ, GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_SYSTEM=os.devnull)
SPECS={'plain':(0,0),'history':(250,0),'resources':(0,4),'combined':(250,4)}

def sha(b): return hashlib.sha256(b).hexdigest()
def write_json(name,data): (BASE/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def run(cmd,**kwargs):
 r=subprocess.run([str(x) for x in cmd],env=kwargs.pop('env',ENV),capture_output=True,**kwargs)
 if r.returncode: raise RuntimeError((cmd,r.returncode,r.stderr.decode(errors='replace')[:2000],r.stdout.decode(errors='replace')[:2000]))
 return r

def tree(root):
 return {str(p.relative_to(root)):sha(p.read_bytes()) for p in sorted(root.rglob('*')) if p.is_file() and '.git' not in p.relative_to(root).parts}

def setup():
 (BASE/'fixtures').mkdir()
 inventory={}
 for case,(edges,per_owner) in SPECS.items():
  root=BASE/'fixtures'/case; reports=root/'docs/investigations'; reports.mkdir(parents=True)
  run(['git','init','-q',root])
  for i in range(376):
   id=f'260101-record-{i:04d}'
   relations=[] if i==0 or i>edges else [{'type':'补充','target':f'260101-record-{i-1:04d}'}]
   fields={'title':f'Record {i}','id':id,'formedAt':'2026-01-01T00:00:00Z','question':'What was observed?','tags':['fixture'],'relations':relations}
   front='---\n'+''.join(f'{k}: {json.dumps(v,ensure_ascii=False)}\n' for k,v in fields.items() if k not in ['tags','relations'])+'tags:\n  - \"fixture\"\n'
   front+=('relations:\n'+''.join('  - type: \"补充\"\n    target: '+json.dumps(r['target'])+'\n' for r in relations)) if relations else 'relations: []\n'
   front+='---\n'
   body='\n'.join(f'\n## {h}\n\nPrivate controlled diagnostic fixture.\n' for h in ['形成时背景','调查目的','调查范围与依据','调查结果与边界'])
   if per_owner:
    resources=reports/'_resources'/id;resources.mkdir(parents=True)
    body+='\n## 随附资源\n\n'
    for j in range(per_owner):
     name=f'payload-{j:03d}.txt';(resources/name).write_text('fixture\n')
     body+=f'- [{name}](./_resources/{id}/{name})\n'
   (reports/f'{id}.md').write_text(front+body)
  run([NATIVE,'--root',root,'sync-index','--json'])
  run(['git','-C',root,'add','--','docs'])
  run(['git','-C',root,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','controlled baseline'])
  a=run([NATIVE,'--root',root,'check','--json']);b=run(['node',OLD,'--root',root,'check'])
  index=json.loads((reports/'investigation-index.json').read_text())
  assert len(index['entries'])==376
  assert sum(len(x['relations']) for x in index['entries'].values())==edges
  assert sum(len(x['resourceIds']) for x in index['entries'].values())==376*per_owner
  assert json.loads(a.stdout)['result']['formalCount']==376
  assert not json.loads(a.stdout)['result']['warnings']
  (BASE/f'{case}-native.stdout').write_bytes(a.stdout);(BASE/f'{case}-old.stdout').write_bytes(b.stdout)
  inventory[case]={'reports':376,'edges':edges,'unique_history_targets':edges,'resource_references':376*per_owner,'source_bytes':sum(p.stat().st_size for p in reports.glob('*.md')),'tree':tree(root),'native_output':sha(a.stdout),'old_output':sha(b.stdout)}
 write_json('fixture-inventory.json',inventory)

def measure():
 inventory=json.loads((BASE/'fixture-inventory.json').read_text())
 guards={case:tree(BASE/'fixtures'/case) for case in SPECS}
 assert all(guards[k]==inventory[k]['tree'] for k in SPECS)
 jobs=[(case,arm,round) for case in SPECS for arm in ['native','old'] for round in range(20)]
 random.Random(261110).shuffle(jobs)
 rows=[];start_time=datetime.datetime.now(datetime.timezone.utc).isoformat()
 for case,arm,round in jobs:
  root=BASE/'fixtures'/case
  cmd=[NATIVE,'--root',root,'check','--json'] if arm=='native' else ['node',OLD,'--root',root,'check']
  start=time.perf_counter();r=run(cmd);elapsed=time.perf_counter()-start
  assert sha(r.stdout)==inventory[case][f'{arm}_output'],(case,arm,'output changed')
  assert not r.stderr,(case,arm,r.stderr[:200])
  row={'case':case,'arm':arm,'round':round,'wall_s':elapsed,'status':r.returncode,'stdout_sha256':sha(r.stdout),'stdout_bytes':len(r.stdout),'command':[str(x) for x in cmd]}
  rows.append(row)
  with (BASE/'samples.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
 for case in SPECS:assert tree(BASE/'fixtures'/case)==guards[case]
 groups={}
 for case in SPECS:
  groups[case]={}
  for arm in ['native','old']:
   values=sorted(r['wall_s'] for r in rows if r['case']==case and r['arm']==arm)
   groups[case][arm]={'n':len(values),'median_s':statistics.median(values),'min_s':min(values),'max_s':max(values),'p95_s':values[18]}
 write_json('matrix-summary.json',{'start':start_time,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'groups':groups,'guards_unchanged':True})
 print(json.dumps(groups,indent=2),flush=True)

def diagnostics():
 inventory=json.loads((BASE/'fixture-inventory.json').read_text());outputs={}
 for case in SPECS:
  root=BASE/'fixtures'/case
  trace=BASE/f'{case}-trace.jsonl'; env=dict(ENV,GIT_TRACE2_EVENT=str(trace))
  r=run([NATIVE,'--root',root,'check','--json'],env=env)
  assert sha(r.stdout)==inventory[case]['native_output']
  counts=collections.Counter()
  for l in trace.read_text().splitlines():
   v=json.loads(l)
   if v.get('event')=='start': counts[v['argv'][3]]+=1
  r=run([PROBE,'--root',root,'check','--json'])
  assert sha(r.stdout)==inventory[case]['native_output']
  line=next(l for l in r.stderr.decode().splitlines() if l.startswith('RECORD_PROBE '))
  metrics=json.loads(line[len('RECORD_PROBE '):]);outputs[case]={'git_counts':dict(counts),'metrics':metrics}
  assert tree(root)==inventory[case]['tree']
 write_json('diagnostics.json',outputs)
 print('diagnostics saved',flush=True)

if __name__=='__main__':
 {'setup':setup,'measure':measure,'diagnostics':diagnostics}[sys.argv[1]]()
