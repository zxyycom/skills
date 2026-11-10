import hashlib, json, os, pathlib, shutil, subprocess, sys
B=pathlib.Path(__file__).resolve().parent
root=B/'fixtures'/'check-history'
assert root.exists(), 'run dataset setup first'
old=pathlib.Path('/workspace/skills/.local/record-cli/generation-9yliYR/investigation-report')
new=pathlib.Path(sys.argv[1]).resolve()/'investigation-report'
realgit=shutil.which('git'); assert realgit and old.is_file() and new.is_file()
p=B/'fault-probe';p.mkdir(exist_ok=False);wrapper=p/'bin';wrapper.mkdir()
script=wrapper/'git'
script.write_text('''#!/bin/sh
printf '%s\\n' "$*" >> "$FAULT_GIT_LOG"
if [ "$1" = '-C' ] && [ "$3" = 'cat-file' ] && [ "$4" = '--batch' ]; then
  head -c 65537 /dev/zero | tr '\\000' x >&2
fi
exec "$FAULT_REAL_GIT" "$@"
''');script.chmod(0o755)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assets={'old':sha(old),'candidate':sha(new),'wrapper':sha(script),'probe':sha(pathlib.Path(__file__))}
rows=[]
for arm,binary in [('checkpoint',old),('candidate',new)]:
 for injected in (False,True):
  log=p/f'{arm}-{injected}.git-log';env=dict(os.environ,GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null',GIT_TERMINAL_PROMPT='0',LC_ALL='C')
  if injected:env.update(PATH=str(wrapper)+os.pathsep+env['PATH'],FAULT_REAL_GIT=realgit,FAULT_GIT_LOG=str(log))
  command=[str(binary),'--root',str(root),'check','--json'];r=subprocess.run(command,env=env,cwd=root,capture_output=True)
  (p/f'{arm}-{injected}.stdout').write_bytes(r.stdout);(p/f'{arm}-{injected}.stderr').write_bytes(r.stderr)
  parsed=json.loads(r.stdout); warnings=parsed['result']['warnings'];calls=log.read_text().splitlines() if log.exists() else []
  row={'arm':arm,'injected':injected,'exit':r.returncode,'stderr_bytes':len(r.stderr),'stderr_sha256':hashlib.sha256(r.stderr).hexdigest(),'warnings':warnings,'formalCount':parsed['result']['formalCount'],'batch_calls':sum('cat-file --batch' in x for x in calls),'individual_catfile_calls':sum('cat-file -t' in x or 'cat-file blob' in x for x in calls)};rows.append(row)
  assert r.returncode==0 and parsed['result']['formalCount']==376
  if not injected:assert not warnings and not r.stderr
  else:assert row['batch_calls']>0
assert assets=={'old':sha(old),'candidate':sha(new),'wrapper':sha(script),'probe':sha(pathlib.Path(__file__))}
(p/'result.json').write_text(json.dumps({'assets':assets,'real_git':realgit,'rows':rows},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(rows,ensure_ascii=False,indent=2))
