import json, os, subprocess, hashlib, time, pathlib, platform, statistics, sys
P=pathlib.Path('/workspace/skills'); O=P/'dist/record-native-survey-20261108/queries'; B=P/'dist/record-cli-perf-261107-main/assets'; F=P/'dist/record-benchmarks/perf-261107-main'
D={'dr':'decision-records','ir':'investigation-report'}
def sha(b):return hashlib.sha256(b).hexdigest()
def ident(i):return f'260101-record-{i:05d}'
def expected_source_order(n,d,w=8,depth=8):
    arch=set([0,1,3,5,6])|set(range(9,9+w+depth+1)) if d=='dr' else set()
    if n==32 and d=='dr': arch=set([0,1,3,5,6])|set(range(9,18))
    return sorted(range(n),key=lambda i: ('archive/' if i in arch else '')+ident(i)+'.md')
def capture(scenario,d,root,args,check,reps=3):
    cmd=[str(B/D[d]),'--root',str(root),*args,'--json']; out=[]
    for rep in range(reps):
        t=time.perf_counter_ns()
        try:
            p=subprocess.run(cmd,capture_output=True,timeout=30); elapsed=(time.perf_counter_ns()-t)/1e6
            row={'scenario':scenario,'domain':d,'rep':rep+1,'argv':cmd,'ms':elapsed,'exit':p.returncode,'stdout':p.stdout.decode(),'stderr':p.stderr.decode(),'stdout_sha256':sha(p.stdout),'stderr_sha256':sha(p.stderr)}
            try:
                result=json.loads(p.stdout); check(result,p.returncode); row['oracle']='pass'
            except Exception as e: row['oracle']='FAIL: '+repr(e)
        except subprocess.TimeoutExpired as e: row={'scenario':scenario,'domain':d,'rep':rep+1,'argv':cmd,'ms':30000,'timeout':True,'stdout':str(e.stdout),'stderr':str(e.stderr),'oracle':'timeout'}
        with (O/'samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
        print(scenario,d,rep+1,round(row['ms'],3),row['oracle'],flush=True)
        out.append(row)
    return out

def collection(x,d):return x['result']['records' if d=='dr' else 'entries']
def ids(x,d): return [v['decisionId' if d=='dr' else 'id'] for v in collection(x,d)]
def ok(x,code): assert code==0 and x['ok'] and x['version']==2,(code,x)
def listcheck(d,n,offset,limit,empty=False):
 def check(x,c):
  ok(x,c);r=x['result']; expect=[] if empty else [ident(i) for i in range(offset,min(n,offset+limit))]; assert ids(x,d)==expect,(ids(x,d),expect); assert r['total']==(0 if empty else n);assert r['facets']['recordCount']==n;assert r['facets']['tags']==[{'tag':'benchmark','count':n}]
 return check
def metacheck(d,n,hit):
 def check(x,c):
  ok(x,c); r=x['result']; i=r['searchInfo']; assert ids(x,d)==([ident(j) for j in expected_source_order(n,d)[:2]] if hit else []);assert i['counts']['matched']['value']==(n if hit else 0);assert i['counts']['matched']['precision']=='exact'; assert i['coverage']['scanComplete'] is True; assert i['coverage']['resultsComplete']==(not hit); assert i['counts']['returned']==(2 if hit else 0)
 return check
def contentcheck(d,n,hit):
 def check(x,c):
  if d=='ir' and n>2000:
   assert c==1 and not x['ok'] and 'candidate file budget exceeded' in str(x);return
  ok(x,c);r=x['result'];i=r['searchInfo']; matches=[j for j in expected_source_order(n,d) if j%10==7] if hit else []; limit=20 if d=='dr' else 2; expected=matches[:limit];assert ids(x,d)==[ident(j) for j in expected],(ids(x,d),expected);assert i['counts']['returned']==len(expected);trunc=len(matches)>limit;assert i['coverage']['scanComplete']==(not trunc);assert i['coverage']['resultsComplete']==(not trunc);assert i['counts']['matched']['value']==(limit+1 if trunc else len(matches));
  for row in collection(x,d):
   found=[p for p in row['previews'] if p['column'] is not None];assert len(found)==1 and found[0]['preview']=='needle-content-7' and found[0]['ranges']==[{'start':0,'end':16}],found
 return check
def showcheck(d,root):
 def check(x,c):
  ok(x,c);r=x['result'];p=root/'docs'/('decisions' if d=='dr' else 'investigations')/(ident(7)+'.md'); expected=p.read_text();assert r['body' if d=='dr' else 'markdown']==expected;assert (r['record']['decisionId'] if d=='dr' else r['id'])==ident(7);assert not r['warnings']
 return check

meta={'platform':platform.platform(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=P,text=True).strip(),'assets':{},'fixtures':{},'policy':'3 repetitions low cost; 1 at n5000 and 1 for IR candidate budget; 30s timeout; no P95, no warmup; sequential new processes; filesystem cache uncontrolled'}
for d,b in D.items(): meta['assets'][d]={'sha256':sha((B/b).read_bytes()),'version':subprocess.check_output([B/b,'--version'],text=True).strip()}
for n in [32,250,1200,5000]:
 root=F/f'n{n}';meta['fixtures'][str(n)]={'manifest':json.loads((root/'fixture.json').read_text()),'index_sha256':{d:sha((root/'docs'/('decisions' if d=='dr' else 'investigations')/('decision-index.json' if d=='dr' else 'investigation-index.json')).read_bytes()) for d in D}}
(O/'environment.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
for n in [32,250,1200,5000]:
 root=F/f'n{n}'
 for d in D:
  reps=1 if n==5000 else 3
  allstatus=['--status','all'] if d=='dr' else []
  capture(f'n{n}-list-page',d,root,['list','--limit','2','--offset','3',*allstatus],listcheck(d,n,3,2),reps)
  capture(f'n{n}-list-empty',d,root,['list','--tag','not-present','--limit','2',*allstatus],listcheck(d,n,0,2,True),reps)
  capture(f'n{n}-metadata-hit',d,root,['search','benchmark','--in','metadata','--limit','2',*allstatus],metacheck(d,n,True),reps)
  capture(f'n{n}-metadata-miss',d,root,['search','never-present-xyz','--in','metadata','--limit','2',*allstatus],metacheck(d,n,False),reps)
  capture(f'n{n}-content-hit',d,root,['search','needle-content-7','--in','content',*(['--limit','2'] if d=='ir' else []),*allstatus],contentcheck(d,n,True),reps)
  capture(f'n{n}-content-miss',d,root,['search','never-present-xyz','--in','content',*(['--limit','2'] if d=='ir' else []),*allstatus],contentcheck(d,n,False),reps)
  capture(f'n{n}-show-id',d,root,['show',ident(7)],showcheck(d,root),reps)
  capture(f'n{n}-show-name',d,root,['show','record-00007'],showcheck(d,root),reps)
