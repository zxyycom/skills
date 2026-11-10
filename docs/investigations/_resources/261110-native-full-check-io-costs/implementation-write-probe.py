"""Directional local hash-object probe; never updates an index or shared repo."""
import concurrent.futures, datetime, hashlib, json, os, pathlib, random, subprocess, time
B=pathlib.Path(__file__).resolve().parent; root=B/'write-probe-repo'; env=dict(os.environ,GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null',GIT_TERMINAL_PROMPT='0',LC_ALL='C')
def sha(x):return hashlib.sha256(x).hexdigest()
def git(*args,**kwargs):return subprocess.run(['git','-C',str(root),*args],env=env,check=True,capture_output=True,**kwargs)
def one(data):
 r=git('hash-object','-w','--stdin',input=data);return r.stdout.decode().strip(),sha(r.stderr)
if not root.exists():
 root.mkdir();git('init','-q')
payloads=[(f'private immutable probe record {i:04d}\n'+('payload text '+str(i)+'\n')*40).encode() for i in range(128)]
expected=[hashlib.sha1(b'blob '+str(len(x)).encode()+b'\0'+x).hexdigest() for x in payloads]
assert git('rev-parse','--show-object-format').stdout.strip()==b'sha1'
meta={'git_version':subprocess.check_output(['git','--version']).decode().strip(),'command':['git','-C',str(root),'hash-object','-w','--stdin'],'fixture':'128 unique deterministic blobs, immutable content; each K uses prefix; no index operation','payload_sha256':[sha(x) for x in payloads],'expected_git_oid':expected,'script_sha256':sha(pathlib.Path(__file__).read_bytes()),'note':'same existing immutable objects reused; Python threadpool overhead included; local directional small-sample, not Windows or end-to-end stage'}
(B/'write-probe-metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
# Populate identical immutable objects before every measured condition, excluding cold first-write effects.
for data in payloads:one(data)
jobs=[(k,mode,i) for k in (1,8,32,128) for mode in ('serial','parallel4') for i in range(5)];random.Random(261110).shuffle(jobs)
for k,mode,i in jobs:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat(); t=time.perf_counter_ns()
 if mode=='serial':out=[one(d) for d in payloads[:k]]
 else:
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:out=list(pool.map(one,payloads[:k]))
 elapsed=(time.perf_counter_ns()-t)/1e9;end=datetime.datetime.now(datetime.timezone.utc).isoformat()
 assert [x[0] for x in out]==expected[:k] and all(x[1]==sha(b'') for x in out)
 row={'k':k,'mode':mode,'iteration':i,'start_utc':start,'end_utc':end,'wall_s':elapsed,'status':0,'all_oids_verified':True,'stderr_sha256':sha(b'')}
 with (B/'write-probe-samples.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
assert sha(pathlib.Path(__file__).read_bytes())==meta['script_sha256']
