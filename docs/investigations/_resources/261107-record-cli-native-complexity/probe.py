import hashlib, json, os, pathlib, shutil, subprocess, time
R=pathlib.Path('/workspace/skills'); D=R/'dist/record-benchmarks/native-complexity-261107'; A=R/'dist/record-cli-perf-261107-main/assets/investigation-report'; S=R/'dist/record-cli-perf-261107-main/source'; F=R/'dist/record-cli-perf-261107-main/source-files.json'; OUT=R/'docs/investigations/_resources/261107-record-cli-native-complexity'
base=R/'dist/record-benchmarks/perf-261107-main/n1'; rel='docs/investigations/260101-record-00000.md'
sha=lambda x:hashlib.sha256(x).hexdigest()
def tree(p):
 h=hashlib.sha256()
 for f in sorted(p.rglob('*')):
  if f.is_file():h.update(str(f.relative_to(p)).encode()+b'\0'+bytes.fromhex(sha(f.read_bytes())))
 return h.hexdigest()
def source(p):return sha(b''.join((f+'\0').encode()+(p/f).read_bytes() for f in json.loads(F.read_text())['files']))
shapes=[(n,q,'dense') for n in (4096,16384,65536) for q in (1,8,16)]+[(65536,1,'sparse'),(65536,1,'separate')]
for n,q,shape in shapes:
 path=D/f'{shape}-{n}-q{q}'
 body= ('x'*n if shape=='dense' else ('x'+'z'*(n-1) if shape=='sparse' else ('xz'*(n//2))))
 expected=(base/rel).read_text()+'\n'+body+'\n'
 if not path.exists():
  shutil.copytree(base,path)
  (path/rel).write_text(expected)
 assert (path/rel).read_text()==expected

def guard():return {'source':source(R/'tools/record-cli'),'snapshot':source(S),'asset':sha(A.read_bytes()),'fixtures':{f'{s}-{n}-q{q}':tree(D/f'{s}-{n}-q{q}') for n,q,s in shapes},'probe':sha((OUT/'probe.py').read_bytes())}
before=guard();(OUT/'guard-before.json').write_text(json.dumps(before,indent=2)+'\n')
assert before['source']==before['snapshot'] and before['asset']=='1e1aa4a14553239e2cbe22723d738ee53b3dc46b53ba9a355add3825c453ab20'
rows=[]
for n,q,shape in shapes:
 root=D/f'{shape}-{n}-q{q}'; query=' '.join('x'*j for j in range(1,q+1)); args=[str(A),'search',query,'--in','content','--match','any','--root',str(root),'--json']; first=None; target=1; i=0
 while i<target:
  start=time.time_ns(); t=time.perf_counter_ns()
  try:p=subprocess.run(args,capture_output=True,timeout=12)
  except subprocess.TimeoutExpired as e:
   rows.append({'n':n,'q':q,'shape':shape,'iteration':i,'timeoutSeconds':12}); (OUT/'samples.jsonl').write_text(''.join(json.dumps(x)+'\n' for x in rows)); raise
  elapsed=(time.perf_counter_ns()-t)/1e6
  assert p.returncode==0 and p.stderr==(b'search previews limited: preview-characters\n' if n>24000 and shape!='separate' else (b'search previews limited: match-previews,preview-characters\n' if n>24000 else b'')),(p.returncode,p.stderr[:500]); j=json.loads(p.stdout); res=j['result']; assert j['ok'] and len(res['entries'])==1 and res['entries'][0]['id']=='260101-record-00000'
  info=res['searchInfo']; assert info['coverage']['scanComplete'] and info['coverage']['resultsComplete'] and info['counts']['matched']=={'value':1,'precision':'exact'}
  previews=[z for z in res['entries'][0]['previews'] if z['ranges']]; assert len(previews)==1
  ranges=previews[0]['ranges']; expected=([{'start':0,'end':min(n,24000)}] if shape=='dense' else ([{'start':0,'end':1}] if shape=='sparse' else [{'start':0,'end':1},{'start':2,'end':3},{'start':4,'end':5}]))
  assert ranges==expected,(n,q,shape,ranges); assert res['truncation']['matches']==(shape=='separate'); assert res['truncation']['previewCharacters']==(n>24000)
  d=sha(p.stdout); first=first or d; assert d==first
  rows.append({'n':n,'q':q,'shape':shape,'iteration':i,'startedUtcNs':start,'ms':round(elapsed,3),'fileBytes':(root/rel).stat().st_size,'indexBytes':(root/'docs/investigations/investigation-index.json').stat().st_size,'stdoutBytes':len(p.stdout),'stdoutSha256':d,'rangeCount':len(ranges),'firstRange':ranges[0],'matchesTruncated':res['truncation']['matches'],'previewCharactersTruncated':res['truncation']['previewCharacters'],'coverage':info['coverage']})
  (OUT/'samples.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows))
  if i==0:target=5 if elapsed<100 else (2 if elapsed<500 else 1)
  i+=1
 print(n,q,shape,'times',','.join(str(r['ms']) for r in rows if r['n']==n and r['q']==q and r['shape']==shape),flush=True)
after=guard();(OUT/'guard-after.json').write_text(json.dumps(after,indent=2)+'\n');assert after==before
