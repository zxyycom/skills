import pathlib,subprocess,json,hashlib,os
P=pathlib.Path('/workspace/skills'); out=P/'dist/record-benchmarks/261110-wide-review/code'; exe=P/'.local/record-cli/generation-jWtx84/decision-records'
rows=[]
for n in (20,40):
 root=out/f'reallocation-{n}'; assert not root.exists(), root
 d=root/'docs/decisions'; a=d/'archive'; a.mkdir(parents=True)
 p=lambda i:f'260101-prev-{i:04}'; s=lambda i:f'260101-next-{i:04}'
 for kind,count in [('prev',n+1),('next',n)]:
  for i in range(count):
   id=p(i) if kind=='prev' else s(i); targets=[p(i),p(i+1)] if kind=='next' else []
   rel='relations: []' if not targets else 'relations:\n'+''.join(f'  - type: "重划"\n    target: "{v}"\n' for v in targets).rstrip()
   text=f'''---\ntitle: "Probe {id}"\nid: "{id}"\nstatus: {'archived' if kind=='prev' else 'active'}\nalignment: aligned\ncreatedAt: "2026-01-01T00:00:00Z"\npurpose: "Probe purpose"\nbackground: "Probe background"\ndecision: "Probe decision"\ntags:\n  - "probe"\n{rel}\n---\n\n## 目的\n\nProbe purpose.\n\n## 背景\n\nProbe background.\n\n## 决策\n\n- 采用: Probe decision.\n'''
   ((a if kind=='prev' else d)/f'{id}.md').write_text(text)
 def run(args):
  cmd=[str(exe),*args,'--json','--root',str(root)]; r=subprocess.run(cmd,capture_output=True,timeout=30,env={**os.environ,'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null'})
  row={'argv':cmd,'exit':r.returncode,'stdout':r.stdout.decode(),'stderr':r.stderr.decode()}; rows.append(row)
  (out/'reallocation-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
  assert r.returncode==0,row
  o=json.loads(r.stdout); assert o.get('ok',o.get('status')=='ok'),o
  return o
 run(['sync-index']);run(['check']); obj=run(['sync-index','--select',s(n-1),'--preflight'])
 expected=sorted([p(i) for i in range(n+1)]+[s(i) for i in range(n)])
 got=obj['result']['coverage']['checkedIds'];assert sorted(got)==expected,(len(got),len(expected),obj)
 # External model only: mimic ordered edge scans, not instrumented CLI.
 edges=[(s(i),p(j)) for i in range(n) for j in (i,i+1)]; connected={s(n-1)};passes=0
 while True:
  passes+=1; old=len(connected)
  for x,y in edges:
   if x in connected or y in connected:connected.update((x,y))
  if len(connected)==old:break
 assert sorted(connected)==expected
 rows.append({'model_only':True,'n':n,'nodes':len(expected),'edges':len(edges),'passes':passes,'edge_tests':passes*len(edges),'binary_sha256':hashlib.sha256(exe.read_bytes()).hexdigest()})
 (out/'reallocation-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 print(n,len(got),passes,passes*len(edges))
