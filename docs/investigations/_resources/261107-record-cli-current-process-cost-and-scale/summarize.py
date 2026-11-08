import collections,json,statistics,sys
base='/workspace/skills/dist/record-benchmarks/perf-261107-main/'
by=collections.defaultdict(list)
for phase in sys.argv[1:]:
 for line in open(base+phase+'-samples.jsonl'):
  r=json.loads(line);by[(phase,r['key'],r['arm'])].append(r)
for (phase,key,arm),rows in sorted(by.items()):
 values=sorted(x['ms'] for x in rows)
 assert len(values)==(20 if phase in ('formal','addon') else 2)
 print(json.dumps({'phase':phase,'scenario':key,'arm':arm,'count':len(values),'median_ms':statistics.median(values),'p95_ms':values[(95*len(values)+99)//100-1],'min_ms':values[0],'max_ms':values[-1],'nonzero_stderr':sum(x['stderrBytes']>0 for x in rows),'stdout_bytes':sorted(set(x['stdoutBytes'] for x in rows)),'stderr_bytes':sorted(set(x['stderrBytes'] for x in rows))},ensure_ascii=False))
