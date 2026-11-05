#!/usr/bin/env python3
"""Interleaved CLI measurement; explicit --run required, private JSONL output only."""
import argparse, datetime, hashlib, json, os, platform, shutil, subprocess, sys, time
from pathlib import Path
R=Path('/workspace/skills'); PROV=R/'docs/investigations/_resources/261105-rust-native-query-performance/provenance.json'
B=Path('/tmp/decision-records-rust-target/release/decision-records-rust-experiment')
SHA='863e91862111f68e7a54505d14369a8d2afcdb2f37aac371f0a0f5099676e788'
ROOTS={100:Path('/tmp/decisions-bench-100-22269'),1000:Path('/tmp/decision-rust-bench-1000'),10000:Path('/tmp/decision-rust-bench-10000')}
CASES={'page':['list','--tag','benchmark','--limit','10','--offset','20'],'metadata-zero':['search','absent-marker','--in','metadata']}
def hashfile(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1048576),b''): h.update(b)
 return h.hexdigest()
def tree(root,sub):
 h=hashlib.sha256()
 for p in sorted((root/sub).rglob('*')):
  if p.is_file(): h.update(str(p.relative_to(root)).encode()+b'\0');h.update(bytes.fromhex(hashfile(p)))
 return h.hexdigest()
def sha(b): return hashlib.sha256(b).hexdigest()
def version(exe): return subprocess.run([exe,'--version'],capture_output=True,text=True,check=True,timeout=10).stdout.strip()
def state():
 return {'binary_sha256':hashfile(B),'distribution_sha256':tree(R,'skills/decision-records/scripts'),'fixtures':{str(n):tree(root,'docs/decisions') for n,root in ROOTS.items()},'source_files':{p:hashfile(R/p) for p in provenance['sourceFiles']},'package_json_sha256':hashfile(R/'package.json')}
def emit(row):
 f.write(json.dumps(row,ensure_ascii=False)+'\n'); f.flush()
p=argparse.ArgumentParser();p.add_argument('--run',action='store_true');a=p.parse_args()
if not a.run: p.error('requires explicit --run')
provenance=json.loads(PROV.read_text()); diffs={n:json.loads(Path(f'/tmp/dr-final-{n}.json').read_text()) for n in ROOTS}
bun=shutil.which('bun');node=shutil.which('node'); assert bun and node
out=Path(__file__).with_name('interleaved-results.jsonl')
# Exclusive creation refuses to overwrite prior evidence.
with out.open('x',encoding='utf-8') as f:
 before=state(); good=before['binary_sha256']==SHA and before['source_files']==provenance['sourceFiles']
 good &= all(before['fixtures'][str(n)]==diffs[n]['rootSha256'] and str(root)==diffs[n]['root'] and before['distribution_sha256']==diffs[n]['distributionSha256'] and diffs[n]['rustSha256']==SHA and all(diffs[n]['cases'][c]['equal'] for c in CASES) for n,root in ROOTS.items())
 emit({'type':'header','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'host':platform.platform(),'python':sys.version,'bun':version(bun),'bun_path':os.path.realpath(bun),'node':version(node),'node_path':os.path.realpath(node),'cwd':str(R),'environment_keys':{k:os.environ.get(k) for k in ['LANG','LC_ALL','TZ']},'script_sha256':hashfile(Path(__file__)),'expected_binary_sha256':SHA,'before':before,'preflight_ok':bool(good),'warmup_rounds':2,'sample_rounds':12,'cases':CASES,'schedule':'rotating 3 sizes; alternating reverse and language order; case order alternates; each scale/case has one language pair each round; warmups included','runtime_boundary':'bun run --silent decision-records invokes node distribution; runner overhead included; fresh CLI subprocesses, wall only'})
 if not good: raise SystemExit('preflight fingerprint mismatch')
 error=None
 try:
  for rnd in range(-2,12):
   sizes=[100,1000,10000]; shift=(rnd+2)%3; sizes=sizes[shift:]+sizes[:shift]
   if (rnd+2)%2: sizes.reverse()
   cases=list(CASES); cases=cases if (rnd+2)%2==0 else cases[::-1]
   for n in sizes:
    for case in cases:
     order=['node','rust'] if (rnd+2+sizes.index(n)+cases.index(case))%2==0 else ['rust','node']
     for kind in order:
      root=ROOTS[n]; cmd=([bun,'run','--silent','decision-records'] if kind=='node' else [str(B)])+CASES[case]+['--root',str(root)]
      start=time.perf_counter_ns();proc=subprocess.run(cmd,cwd=R,capture_output=True,timeout=120); elapsed=(time.perf_counter_ns()-start)/1e6
      outb=proc.stdout.replace(str(root).encode(),b'<ROOT>'); errb=proc.stderr.replace(str(root).encode(),b'<ROOT>'); expected=diffs[n]['cases'][case][kind]
      matched=(proc.returncode==expected['exit'] and outb==expected['stdout'].encode() and errb==expected['stderr'].encode())
      emit({'type':'sample','round':rnd,'warmup':rnd<0,'n':n,'case':case,'kind':kind,'command':cmd,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsed_ms':elapsed,'exit':proc.returncode,'stdout_sha256':sha(outb),'stdout_bytes':len(outb),'stderr_sha256':sha(errb),'stderr_bytes':len(errb),'matches_frozen':matched})
      if not matched: raise RuntimeError(f'outcome mismatch {rnd=} {n=} {case=} {kind=}')
 except BaseException as e:
  error=repr(e);raise
 finally:
  after=state(); emit({'type':'footer','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'after':after,'no_drift':after==before,'error':error})
  if after!=before: raise SystemExit('fingerprint drift')
