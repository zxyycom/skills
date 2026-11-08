import pathlib, subprocess, time, json, hashlib
P=pathlib.Path('/workspace/skills'); O=P/'dist/record-native-survey-20261108/queries'; B=P/'dist/record-cli-perf-261107-main/assets'; F=P/'dist/record-benchmarks/perf-261107-main'; D={'dr':'decision-records','ir':'investigation-report'}
def ident(i):return f'260101-draft-{i:05d}'
for n in [1,32,250]:
 root=O/f'candidates-{n}'
 for d in D:
  folder=root/'docs'/('decisions' if d=='dr' else 'investigations');folder.mkdir(parents=True,exist_ok=False)
  for i in range(n):
   id=ident(i)
   text=(f'---\ntitle: Decision title\nid: {id}\nstatus: candidate\nalignment: null\ncreatedAt: null\npurpose: Purpose text\nbackground: Background text\ndecision: Decision text\ntags: [tag]\nrelations: []\n---\n\n## 目的\nText\n\n## 背景\nText\n\n## 决策\n- 采用: Choice\n' if d=='dr' else f'---\ntitle: "A title"\nid: "{id}"\nformedAt: "2026-01-01T00:00:00Z"\nquestion: "A question"\ntags:\n  - "topic"\nrelations: []\n---\n\n## 形成时背景\n背景\n\n## 调查目的\n目的\n\n## 调查范围与依据\n范围\n\n## 调查结果与边界\n结果\n')
   (folder/(f'{id}.md' if d=='dr' else f'_candidate.{id}')).write_text(text)

def run(s,d,root,args,check,reps=3):
 cmd=[str(B/D[d]),'--root',str(root),*args,'--json']
 for rep in range(reps):
  t=time.perf_counter_ns();p=subprocess.run(cmd,capture_output=True,timeout=30);ms=(time.perf_counter_ns()-t)/1e6
  row={'scenario':s,'domain':d,'rep':rep+1,'argv':cmd,'ms':ms,'exit':p.returncode,'stdout':p.stdout.decode(),'stderr':p.stderr.decode(),'stdout_sha256':hashlib.sha256(p.stdout).hexdigest(),'stderr_sha256':hashlib.sha256(p.stderr).hexdigest()}
  try:check(json.loads(p.stdout),p.returncode);row['oracle']='pass'
  except Exception as e:row['oracle']='FAIL: '+repr(e)
  with (O/'samples.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
  print(s,d,rep+1,round(ms,3),row['oracle'],flush=True)
def ck_empty(d):
 def c(x,e):assert e==0 and x['ok'] and x['result']['records' if d=='dr' else 'candidates']==[]
 return c
def ck_all(d,n):
 def c(x,e):
  assert e==0 and x['ok'],x;items=x['result']['records' if d=='dr' else 'candidates'];assert [v['decisionId' if d=='dr' else 'id'] for v in items]==[ident(i) for i in range(n)];assert all((v['scaffoldValid'] and v['bodyReady']) if d=='dr' else all(v['readiness'].values()) for v in items)
 return c
def ck_one(d,root):
 def c(x,e):
  assert e==0 and x['ok'],x;r=x['result']; v=r['record' if d=='dr' else 'candidate']; assert v['decisionId' if d=='dr' else 'id']==ident(0);assert (v['scaffoldValid'] and v['bodyReady']) if d=='dr' else all(v['readiness'].values());p=root/'docs'/('decisions' if d=='dr' else 'investigations')/(ident(0)+'.md' if d=='dr' else '_candidate.'+ident(0));assert (r['body'] if d=='dr' else v['markdown'])==p.read_text()
 return c
for n in [32,1200,5000]:
 for d in D:run(f'n{n}-candidates-empty',d,F/f'n{n}',['candidates'],ck_empty(d),1 if n==5000 else 3)
for n in [1,32,250]:
 root=O/f'candidates-{n}'
 for d in D:
  run(f'candidate-{n}-all',d,root,['candidates'],ck_all(d,n),3)
  run(f'candidate-{n}-show-id',d,root,['show-candidate',ident(0)],ck_one(d,root),3)
  run(f'candidate-{n}-show-name',d,root,['show-candidate','draft-00000'],ck_one(d,root),3)
