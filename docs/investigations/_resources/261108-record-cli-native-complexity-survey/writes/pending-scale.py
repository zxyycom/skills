import subprocess,json,pathlib,time
P=pathlib.Path('/workspace/skills/dist/record-native-survey-20261108/writes');root=P/'fixture-scale-250';binary='/workspace/skills/dist/record-cli-perf-261107-main/assets/decision-records';out=P/'pending-scale.jsonl';assert root.exists() and not out.exists()
def git(*a):
 p=subprocess.run(['git',*a],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30);assert p.returncode==0,p.stderr;return p.stdout
extra=root/'unrelated-pending';extra.mkdir();last=0
for added in (0,500,1500):
 for i in range(last,added):(extra/f'pending-{i:04d}.txt').write_text('unrelated pending\n')
 if added>last:git('add','--','unrelated-pending')
 last=added;before=git('ls-files','--stage','-z');count=len(before.split(b'\0'))-1;assert git('show',':sentinel')==b'pending\n'
 for repeat in range(3):
  argv=[binary,'stage','260101-record-00050','--scope','index','--root',str(root),'--json'];start=time.perf_counter_ns();r=subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30);ms=round((time.perf_counter_ns()-start)/1e6,3);o=json.loads(r.stdout);after=git('ls-files','--stage','-z');errors=[]
  if r.returncode or not o.get('ok'):errors.append('CLI failed')
  if before!=after:errors.append('pending membership changed')
  if git('show',':sentinel')!=b'pending\n':errors.append('sentinel changed')
  with open(out,'a') as f:f.write(json.dumps(dict(extra=added,pending_members=count,repeat=repeat+1,ms=ms,argv=argv,exit=r.returncode,result=o,errors=errors))+'\n')
  print('P',count,'time',ms,'errors',errors,flush=True)
