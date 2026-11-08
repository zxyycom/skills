import json, subprocess, time, pathlib, hashlib
P=pathlib.Path('/workspace/skills'); O=P/'dist/record-native-survey-20261108/queries'; B=P/'dist/record-cli-perf-261107-main/assets'; F=P/'dist/record-benchmarks/perf-261107-main/n32'; D={'dr':'decision-records','ir':'investigation-report'}
def run(s,d,args,check,root=F,reps=3,globaljson=False):
 cmd=[str(B/D[d]),'--root',str(root),*(['--json'] if globaljson else []),*args,*([] if globaljson else ['--json'])]
 for rep in range(reps):
  t=time.perf_counter_ns();p=subprocess.run(cmd,capture_output=True,timeout=30);ms=(time.perf_counter_ns()-t)/1e6
  row={'scenario':s,'domain':d,'rep':rep+1,'argv':cmd,'ms':ms,'exit':p.returncode,'stdout':p.stdout.decode(),'stderr':p.stderr.decode(),'stdout_sha256':hashlib.sha256(p.stdout).hexdigest(),'stderr_sha256':hashlib.sha256(p.stderr).hexdigest()}
  try:check(json.loads(p.stdout),p.returncode);row['oracle']='pass'
  except Exception as e:row['oracle']='FAIL: '+repr(e)
  with (O/'samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
  print(s,d,rep+1,round(ms,3),row['oracle'],flush=True)
def success(x,e):assert e==0 and x['ok'],x
def meta(count,d,returned):
 def check(x,e):
  success(x,e);r=x['result'];i=r['searchInfo']; assert i['counts']['matched']['value']==count and i['counts']['matched']['precision']=='exact' and i['counts']['returned']==returned;assert i['coverage']['scanComplete'] and i['coverage']['resultsComplete']==(count==returned)
 return check
def page(total,d,expected):
 def check(x,e):
  success(x,e);r=x['result']; assert r['total']==total; items=r['records' if d=='dr' else 'entries']; assert [v['decisionId' if d=='dr' else 'id'] for v in items]==expected; assert r['facets']['recordCount']==32
 return check
def error(code,fragment):
 def check(x,e):assert e==code and not x['ok'] and fragment in str(x),(e,x)
 return check
for d in D:
 allstatus=['--status','all'] if d=='dr' else []
 run('metadata-nfkc',d,['search','ＢＥＮＣＨＭＡＲＫ','--in','metadata','--limit','2',*allstatus],meta(32,d,2))
 run('metadata-any',d,['search','never-present-xyz benchmark','--match','any','--in','metadata','--limit','2',*allstatus],meta(32,d,2))
 run('metadata-all',d,['search','never-present-xyz benchmark','--match','all','--in','metadata','--limit','2',*allstatus],meta(0,d,0))
 run('metadata-phrase',d,['search','BENCHMARK record-00007','--match','phrase','--in','metadata','--limit','2',*allstatus],meta(1,d,1))
 bounds=['--created-from','2026-01-01','--created-to','2026-01-01'] if d=='dr' else ['--formed-from','2026-01-01','--formed-to','2026-01-01']
 run('list-tag-date',d,['list','--tag','benchmark','--limit','2',*bounds,*allstatus],page(32,d,['260101-record-00000','260101-record-00001']))
 run('show-not-found',d,['show','260101-missing'],error(1,'selector-not-found'))
 run('search-blank',d,['search','   '],error(2,'search text must not be empty'))
 run('global-json-before-command',d,['list'],error(2,'unsupported query command: --json'),reps=1,globaljson=True)
run('dr-list-active', 'dr',['list','--limit','2'],page(18,'dr',['260101-record-00002','260101-record-00004']))
run('dr-list-archived','dr',['list','--status','archived','--limit','2'],page(14,'dr',['260101-record-00000','260101-record-00001']))
run('dr-list-unaligned','dr',['list','--status','all','--alignment','unaligned','--limit','2'],page(0,'dr',[]))
run('dr-content-limit-rejected','dr',['search','needle','--in','content','--limit','2'],error(2,'content search does not accept --limit'))
