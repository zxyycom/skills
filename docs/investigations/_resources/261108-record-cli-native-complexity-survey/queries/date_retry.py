import pathlib, subprocess, time, json, hashlib
P=pathlib.Path('/workspace/skills'); O=P/'dist/record-native-survey-20261108/queries'; root=P/'dist/record-benchmarks/perf-261107-main/n32'; B=P/'dist/record-cli-perf-261107-main/assets'
for d,exe,field in [('dr','decision-records','created'),('ir','investigation-report','formed')]:
 args=[str(B/exe),'--root',str(root),'list','--tag','benchmark','--limit','2',f'--{field}-from','2026-01-01T00:00:00Z',f'--{field}-to','2026-01-01T00:00:00Z',*(['--status','all'] if d=='dr' else []),'--json']
 for rep in range(1,4):
  t=time.perf_counter_ns();p=subprocess.run(args,capture_output=True,timeout=30);ms=(time.perf_counter_ns()-t)/1e6;row={'scenario':'list-tag-datetime-retry','domain':d,'rep':rep,'argv':args,'ms':ms,'exit':p.returncode,'stdout':p.stdout.decode(),'stderr':p.stderr.decode(),'stdout_sha256':hashlib.sha256(p.stdout).hexdigest(),'stderr_sha256':hashlib.sha256(p.stderr).hexdigest()}
  try:
   x=json.loads(p.stdout);r=x['result'];records=r['records' if d=='dr' else 'entries'];assert p.returncode==0 and x['ok'] and r['total']==32 and r['facets']['recordCount']==32 and [v['decisionId' if d=='dr' else 'id'] for v in records]==['260101-record-00000','260101-record-00001'];row['oracle']='pass'
  except Exception as e:row['oracle']='FAIL: '+repr(e)
  with (O/'samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
  print(row['scenario'],d,rep,round(ms,3),row['oracle'])
