import subprocess,json,pathlib,hashlib,time
P=pathlib.Path('/workspace/skills/dist/record-native-survey-20261108/writes');root=P/'fixture-scale-250';assets=pathlib.Path('/workspace/skills/dist/record-cli-perf-261107-main/assets');out=P/'unselected-audit.jsonl';assert not out.exists()
def git(*a):
 r=subprocess.run(['git',*a],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30);assert not r.returncode,r.stderr;return r.stdout
def pending():
 out={}
 for b in git('ls-files','--stage','-z').split(b'\0'):
  if b: meta,path=b.split(b'\t',1);out[path.decode()]=meta.decode()
 return out
for d,folder,binary in [('d','decisions','decision-records'),('i','investigations','investigation-report')]:
 id='260101-record-00140';src=f'docs/{folder}/{id}.md';index=f'docs/{folder}/{"decision" if d=="d" else "investigation"}-index.json'; p=root/src;p.write_text(p.read_text()+'\nPending preservation audit.\n')
 def run(*a):
  argv=[str(assets/binary),*a,'--root',str(root),'--json']; t=time.perf_counter_ns();r=subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30);o=json.loads(r.stdout);assert r.returncode==0 and o['ok'],o;return argv,round((time.perf_counter_ns()-t)/1e6,3),o
 run('sync-index','--select',id);before=pending();argv,ms,o=run('stage',id,'--scope','all');after=pending();changes={k for k in before.keys()|after.keys() if before.get(k)!=after.get(k)};expected={src,index};assert changes==expected,(changes,expected);assert git('show',':'+src)==p.read_bytes();assert git('show',':sentinel')==b'pending\n'
 with open(out,'a') as f:f.write(json.dumps(dict(domain=d,argv=argv,ms=ms,pending_members=len(before),changed=sorted(changes),unselected_members_compared=len(before)-len(expected),unselected_unchanged=True,staged_source_equal=True,sentinel_preserved=True,result=o))+'\n')
 print(d,'ms',ms,'pending',len(before),'exact changed',changes,'unselected entries same',len(before)-len(expected),flush=True)
