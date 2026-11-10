import collections, datetime, hashlib, json, os, pathlib, random, statistics, subprocess, sys, time
B=pathlib.Path(__file__).resolve().parent
REPO=pathlib.Path('/workspace/skills')
OLD=REPO/'.local/record-cli/generation-jWtx84'
ENV=dict(os.environ, GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null', GIT_TERMINAL_PROMPT='0', LC_ALL='C')
def digest(b): return hashlib.sha256(b).hexdigest()
def sh(cmd,cwd=None,env=ENV):
 r=subprocess.run(list(map(str,cmd)),cwd=cwd,env=env,capture_output=True)
 if r.returncode: raise RuntimeError((list(map(str,cmd)),r.returncode,r.stdout.decode(errors='replace'),r.stderr.decode(errors='replace')))
 return r
def git(p,*args):return sh(['git','-C',p,*args]).stdout
def write(p,obj):p.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n')
def snapshot(p):
 h=hashlib.sha256(); n=0
 for f in sorted(x for x in p.rglob('*') if x.is_file() and '.git' not in x.relative_to(p).parts):
  name=f.relative_to(p).as_posix().encode(); data=f.read_bytes();h.update(len(name).to_bytes(8,'big'));h.update(name);h.update(len(data).to_bytes(8,'big'));h.update(data);n+=1
 return {'sha256':h.hexdigest(),'files':n}
def init(p):
 p.mkdir(parents=True);git(p,'init','-q');git(p,'config','user.name','Fixture');git(p,'config','user.email','fixture@example.invalid');git(p,'config','commit.gpgsign','false')
def commit(p):git(p,'add','--all');git(p,'commit','-qm','fixture baseline')
def setup():
 specs={'plain':(0,0),'history':(250,0),'resources':(0,4),'combined':(250,4)}
 inventory={}
 for case,(edges,per) in specs.items():
  p=B/'fixtures'/('check-'+case);init(p);d=p/'docs/investigations';d.mkdir(parents=True)
  for i in range(376):
   id=f'260101-record-{i:04d}'; fields={'title':f'Record {i}','id':id,'formedAt':'2026-01-01T00:00:00Z','question':'What was observed?'}
   front='---\n'+''.join(f'{k}: {json.dumps(v)}\n' for k,v in fields.items())+'tags:\n  - "fixture"\n'
   front+=('relations:\n  - type: "补充"\n    target: '+json.dumps(f'260101-record-{i-1:04d}')+'\n') if 0<i<=edges else 'relations: []\n';front+='---\n'
   body='\n'.join(f'\n## {h}\n\nPrivate controlled diagnostic fixture.\n' for h in ['形成时背景','调查目的','调查范围与依据','调查结果与边界'])
   if per:
    res=d/'_resources'/id;res.mkdir(parents=True);body+='\n## 随附资源\n\n'
    for j in range(per):
     name=f'payload-{j:03d}.txt';(res/name).write_text('fixture\n');body+=f'- [{name}](./_resources/{id}/{name})\n'
   (d/f'{id}.md').write_text(front+body)
  sh([OLD/'investigation-report','--root',p,'sync-index','--json']);commit(p)
  result=sh([OLD/'investigation-report','--root',p,'check','--json']); parsed=json.loads(result.stdout);idx=json.loads((d/'investigation-index.json').read_text())
  assert len(idx['entries'])==376 and sum(len(x['relations']) for x in idx['entries'].values())==edges and sum(len(x['resourceIds']) for x in idx['entries'].values())==376*per
  assert parsed['result']['formalCount']==376 and not parsed['result']['warnings'] and not result.stderr
  inventory['check-'+case]={'N':376,'unique_prior':edges,'resources':376*per,'tree':snapshot(p),'head':git(p,'rev-parse','HEAD').decode().strip()}
 for typ in ('decision','investigation'):
  p=B/'fixtures'/('stage-'+typ);init(p);d=p/'records';d.mkdir();binary=OLD/('decision-records' if typ=='decision' else 'investigation-report');opt='--decisions-dir' if typ=='decision' else '--investigations-dir'
  tpl=(REPO/'tools/record-cli/tests/fixtures/git-stage/documents'/('decision.md' if typ=='decision' else 'report-no-resources.md')).read_text();orig='240229-record' if typ=='decision' else '240229-report'; ids=[f'240229-record-{n:02d}' for n in range(32)]
  for id in ids:(d/(id+'.md')).write_text(tpl.replace(orig,id))
  sh([binary,'--root',p,opt,'records','sync-index']);(p/'unselected').write_text('baseline\n');commit(p)
  (p/'unselected').write_text('preserve pending\n');git(p,'add','--','unselected')
  # All record files are pending independently from both HEAD and working tree.
  for id in ids:(d/(id+'.md')).write_text((d/(id+'.md')).read_text()+'\nPending content.\n')
  git(p,'add','--',*[f'records/{id}.md' for id in ids]);(B/(typ+'-index.bin')).write_bytes((p/'.git/index').read_bytes())
  for id in ids:(d/(id+'.md')).write_text((d/(id+'.md')).read_text()+'\nWorking content.\n')
  sh([binary,'--root',p,opt,'records','sync-index'])
  inventory['stage-'+typ]={'indexMembers':34,'changedPendingPaths':33,'pending_domain_documents':32,'pending_domain_index':0,'pending_outside':1,'N':32,'tree':snapshot(p),'head':git(p,'rev-parse','HEAD').decode().strip(),'original_index_sha256':digest((B/(typ+'-index.bin')).read_bytes())}
 write(B/'inventory.json',inventory)

def main(candidate):
 assert not (B/'samples.jsonl').exists() and not (B/'oracle.jsonl').exists(), 'refuse to overwrite evidence';cand=pathlib.Path(candidate).resolve(); arms={'baseline':OLD,'candidate':cand};inv=json.loads((B/'inventory.json').read_text());paths={key:B/'fixtures'/key for key in inv};ids=[f'240229-record-{n:02d}' for n in range(32)]
 assets={f'{arm}/{name}':digest((folder/name).read_bytes()) for arm,folder in arms.items() for name in ('decision-records','investigation-report')};assets['script']=digest(pathlib.Path(__file__).read_bytes());assets['inventory']=digest((B/'inventory.json').read_bytes());assets['recompute']=digest((B/'recompute.py').read_bytes());assets.update({f'original_index/{typ}':digest((B/(typ+'-index.bin')).read_bytes()) for typ in ('decision','investigation')})
 guards={key:snapshot(p) for key,p in paths.items()};assert all(guards[k]==inv[k]['tree'] and git(paths[k],'rev-parse','HEAD').decode().strip()==inv[k]['head'] for k in guards)
 assert all(assets[f'original_index/{typ}']==inv['stage-'+typ]['original_index_sha256'] for typ in ('decision','investigation'))
 check_jobs=[('check-'+c,0) for c in ('plain','history','resources','combined')];stage_jobs=[('stage-'+d,k) for d in ('decision','investigation') for k in (1,8,32)];scenarios=check_jobs+stage_jobs
 outputs={};index_ref={}; pending={}
 for typ in ('decision','investigation'):
  p=paths['stage-'+typ];(p/'.git/index').write_bytes((B/(typ+'-index.bin')).read_bytes());pending[typ]={id:git(p,'show',f':records/{id}.md') for id in ids};pending[typ]['outside']=git(p,'show',':unselected')
 def one(case,k,arm,phase,iteration,trace=False):
  p=paths[case];folder=arms[arm]; typ=case.removeprefix('stage-'); env=ENV.copy()
  if trace:env['GIT_TRACE2_EVENT']=str(B/f'trace-{case}-{k}-{arm}.jsonl')
  if case.startswith('check-'):cmd=[folder/'investigation-report','--root',p,'check','--json']
  else:
   (p/'.git/index').write_bytes((B/(typ+'-index.bin')).read_bytes());bin='decision-records' if typ=='decision' else 'investigation-report';opt='--decisions-dir' if typ=='decision' else '--investigations-dir';cmd=[folder/bin,'--root',p,opt,'records','stage','--scope','all',*ids[:k]]
  start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.perf_counter_ns();r=subprocess.run(list(map(str,cmd)),cwd=p,env=env,capture_output=True);elapsed=(time.perf_counter_ns()-t)/1e9;end=datetime.datetime.now(datetime.timezone.utc).isoformat()
  row={'phase':phase,'case':case,'k':k,'arm':arm,'iteration':iteration,'command':list(map(str,cmd)),'start_utc':start,'end_utc':end,'wall_s':elapsed,'exit':r.returncode,'stdout_sha256':digest(r.stdout),'stderr_sha256':digest(r.stderr),'stdout_bytes':len(r.stdout),'stderr_bytes':len(r.stderr)}
  with (B/'samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
  assert r.returncode==0 and not r.stderr,row
  key=(case,k);out=json.loads(r.stdout) if case.startswith('check-') else r.stdout.decode()
  if case.startswith('check-'):
   assert out['result']['formalCount']==376 and not out['result']['warnings']
  else:
   assert git(p,'show',':unselected')==pending[typ]['outside']
   for i,id in enumerate(ids):assert git(p,'show',f':records/{id}.md')==((p/'records'/f'{id}.md').read_bytes() if i<k else pending[typ][id]),(case,k,arm,id)
   index=git(p,'show',':records/'+('decision-index.json' if typ=='decision' else 'investigation-index.json'));assert len(json.loads(index)['entries'])==32
   if key in index_ref:assert index==index_ref[key],('index mismatch',case,k,arm)
   else:index_ref[key]=index
   row['staged_index_sha256']=digest(index)
   manifest=git(p,'ls-files','--stage','-z'); manifest_key=(case,k,'manifest')
   if manifest_key in index_ref:assert manifest==index_ref[manifest_key],('full staged manifest mismatch',case,k,arm)
   else:index_ref[manifest_key]=manifest
   row['staged_manifest_sha256']=digest(manifest)
  if key not in outputs:(B/f'output-{case}-{k}.bin').write_bytes(r.stdout)
  if key in outputs:assert out==outputs[key],('output mismatch',case,k,arm)
  else:outputs[key]=out
  with (B/'oracle.jsonl').open('a') as f:f.write(json.dumps({'phase':phase,'case':case,'k':k,'arm':arm,'iteration':iteration,'passed':True,'staged_index_sha256':row.get('staged_index_sha256'),'staged_manifest_sha256':row.get('staged_manifest_sha256')})+'\n')
  return row
 # Separate oracle/warmup and randomized wall batches. Stop at first failed oracle; retain raw row.
 for case,k in scenarios:
  for arm in arms:one(case,k,arm,'warmup',0)
 jobs=[(case,k,arm,i) for case,k in scenarios for arm in arms for i in range(20)];random.Random(261110).shuffle(jobs);rows=[]
 for case,k,arm,i in jobs:rows.append(one(case,k,arm,'wall',i))
 for case,k in scenarios:
  for arm in arms:one(case,k,arm,'trace',0,True)
 assert all(snapshot(paths[k])==guards[k] and git(paths[k],'rev-parse','HEAD').decode().strip()==inv[k]['head'] for k in guards)
 assert digest((B/'recompute.py').read_bytes())==assets['recompute'];assert digest((B/'inventory.json').read_bytes())==assets['inventory'] and all(digest((B/(typ+'-index.bin')).read_bytes())==assets[f'original_index/{typ}'] for typ in ('decision','investigation'))
 assert all(digest((folder/name).read_bytes())==assets[f'{arm}/{name}'] for arm,folder in arms.items() for name in ('decision-records','investigation-report')) and digest(pathlib.Path(__file__).read_bytes())==assets['script']
 summary={}
 for case,k in scenarios:
  for arm in arms:
   vals=sorted(r['wall_s'] for r in rows if (r['case'],r['k'],r['arm'])==(case,k,arm));summary[f'{case}/{k}/{arm}']={'n':len(vals),'median_s':statistics.median(vals),'p95_nearest_rank_s':vals[18],'min_s':vals[0],'max_s':vals[-1]}
 counts={}
 for case,k in scenarios:
  for arm in arms:
   path=B/f'trace-{case}-{k}-{arm}.jsonl';assert path.exists() or case=='check-plain',('unexpected missing trace',str(path));events=[json.loads(line) for line in path.read_text().splitlines()] if path.exists() else [];c=collections.Counter(' '.join(e.get('argv',[])[3:5]) for e in events if e.get('event')=='start');counts[f'{case}/{k}/{arm}']={'git_starts':sum(c.values()),'trace_file_exists':path.exists(),'commands':dict(c)}
 write(B/'trace-counts.json',counts)
 write(B/'summary.json',{'seed':261110,'assets':assets,'guards_before_after_equal':True,'groups':summary})
if __name__=='__main__':
 if sys.argv[1]=='setup':setup()
 else:main(sys.argv[2])
