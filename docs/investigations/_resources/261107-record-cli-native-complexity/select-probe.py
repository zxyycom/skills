import hashlib,json,pathlib,subprocess,time
R=pathlib.Path('/workspace/skills');D=R/'dist/record-benchmarks/perf-261107-main/n5000';A=R/'dist/record-cli-perf-261107-main/assets/investigation-report'; O=R/'docs/investigations/_resources/261107-record-cli-native-complexity'; F=R/'dist/record-cli-perf-261107-main/source-files.json';S=R/'dist/record-cli-perf-261107-main/source';sha=lambda b:hashlib.sha256(b).hexdigest()
def tree(p):
 h=hashlib.sha256()
 for f in sorted(p.rglob('*')):
  if f.is_file():h.update(str(f.relative_to(p)).encode()+b'\0'+bytes.fromhex(sha(f.read_bytes())))
 return h.hexdigest()
def source(p):return sha(b''.join((f+'\0').encode()+(p/f).read_bytes() for f in json.loads(F.read_text())['files']))
def guard():return {'asset':sha(A.read_bytes()),'fixture':tree(D),'worktree':source(R/'tools/record-cli'),'snapshot':source(S),'script':sha((O/'select-probe.py').read_bytes())}
before=guard();(O/'select-guard-before.json').write_text(json.dumps(before,indent=2)+'\n');assert before['worktree']==before['snapshot'];rows=[]
for k in (1,100,500,1000):
 for mode in ('id','name'):
  ids=[f'260101-record-{i:05d}' for i in range(4000,4000+k)];sels=ids if mode=='id' else [x[7:] for x in ids];args=[str(A),'sync-index','--preflight'];
  for s in sels:args.extend(['--select',s])
  args+=['--root',str(D),'--json'];i=0;target=1;first=None
  while i<target:
   start=time.time_ns();t=time.perf_counter_ns()
   try:p=subprocess.run(args,capture_output=True,timeout=20)
   except subprocess.TimeoutExpired:
    rows.append({'k':k,'mode':mode,'iteration':i,'timeoutSeconds':20});(O/'select-samples.jsonl').write_text(''.join(json.dumps(x)+'\n' for x in rows));raise
   ms=(time.perf_counter_ns()-t)/1e6;assert p.returncode==0 and not p.stderr,(p.returncode,p.stderr[:500]);j=json.loads(p.stdout);r=j['result'];assert j['ok'] and r['scope']=='selected' and r['state']=='unchanged' and not r['changed'] and r['changedIds']==[] and r['selectedIds']==ids and r['selectors']==sels and r['reportCount']==5000 and r['coverage']['checkedIds']==ids and r['coverage']['currentness']=='selected-and-dependencies' and not r['warnings'];d=sha(p.stdout);first=first or d;assert d==first
   rows.append({'k':k,'mode':mode,'iteration':i,'startedUtcNs':start,'ms':round(ms,3),'stdoutBytes':len(p.stdout),'stdoutSha256':d,'selectedCount':len(r['selectedIds']),'checkedCount':len(r['coverage']['checkedIds']),'state':r['state'],'changed':r['changed']});(O/'select-samples.jsonl').write_text(''.join(json.dumps(x)+'\n' for x in rows))
   if i==0:target=5 if ms<100 else (2 if ms<500 else 1)
   i+=1
  print(k,mode,','.join(str(x['ms']) for x in rows if x['k']==k and x['mode']==mode),flush=True)
after=guard();(O/'select-guard-after.json').write_text(json.dumps(after,indent=2)+'\n');assert before==after
