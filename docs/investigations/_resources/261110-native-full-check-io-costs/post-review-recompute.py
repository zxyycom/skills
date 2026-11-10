import collections,hashlib,json,math,pathlib,statistics
B=pathlib.Path(__file__).resolve().parent
rows=[json.loads(s) for s in (B/'samples.jsonl').read_text().splitlines()];oracle=[json.loads(s) for s in (B/'oracle.jsonl').read_text().splitlines()]
assert len(rows)==len(oracle)==440
assert collections.Counter(r['phase'] for r in rows)=={'warmup':20,'wall':400,'trace':20}
assert all(r['exit']==0 and r['stderr_sha256']==hashlib.sha256(b'').hexdigest() for r in rows)
assert all(o['passed'] for o in oracle)
groups={}; traces={}
for case,k in [(f'check-{c}',0) for c in ('plain','history','resources','combined')]+[(f'stage-{d}',k) for d in ('decision','investigation') for k in (1,8,32)]:
 key=f'{case}/{k}';groups[key]={}
 for arm in ('baseline','candidate'):
  v=sorted(r['wall_s'] for r in rows if (r['phase'],r['case'],r['k'],r['arm'])==('wall',case,k,arm));assert len(v)==20
  groups[key][arm]={'n':len(v),'median_s':statistics.median(v),'p95_nearest_rank_s':v[math.ceil(.95*len(v))-1],'min_s':v[0],'max_s':v[-1]}
  path=B/f'trace-{case}-{k}-{arm}.jsonl'
  if not path.exists():assert case=='check-plain' and k==0,('unexpected missing trace',str(path))
  events=[json.loads(s) for s in path.read_text().splitlines()] if path.exists() else []
  counts=collections.Counter(' '.join(e.get('argv',[])[3:5]) for e in events if e.get('event')=='start')
  traces[f'{key}/{arm}']={'git_starts':sum(counts.values()),'trace_file_exists':path.exists(),'commands':dict(counts)}
 relevant=[x for x in oracle if x['case']==case and x['k']==k];assert len(relevant)==44
 if case.startswith('stage-'):
  assert len(set(x['staged_index_sha256'] for x in relevant))==1
  assert len(set(x['staged_manifest_sha256'] for x in relevant))==1
 groups[key]['candidate_over_baseline_median']=groups[key]['candidate']['median_s']/groups[key]['baseline']['median_s']
summary={'interpretation':'20 per arm; p95 nearest rank. WSL2 Linux; not Windows; no cache clearing. Independent recomputation from raw rows; missing trace permitted only on plain check.','groups':groups,'oracle_count':len(oracle),'wall_count':400}
(B/'independent-summary.json').write_text(json.dumps(summary,indent=2)+'\n');(B/'trace-counts.json').write_text(json.dumps(traces,indent=2)+'\n')
print(json.dumps(summary,indent=2));print('TRACE');print(json.dumps({k:v['git_starts'] for k,v in traces.items()},indent=2))
