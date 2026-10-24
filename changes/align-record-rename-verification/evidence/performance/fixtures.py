"""1k keeps 100 chains of length ten; same selected terminal ID and 90% relation density."""
import json,pathlib,shutil,subprocess
from setup import ROOT,HERE,env,git,manifest,save,FIXTURE_HEAD
ENTRIES={'dr':'skills/decision-records/scripts/decision-records.ts','ir':'skills/investigation-report/scripts/check-investigations.ts'}
def prepare():
 dest=ROOT/'probe';assert not dest.exists()
 subprocess.run(['git','-c','core.hooksPath=/dev/null','clone','--no-hardlinks','--no-checkout',str(ROOT/'fixture'),str(dest)],check=True,env=env(),capture_output=True)
 git(dest,'remote','remove','origin');git(dest,'config','core.hooksPath','/dev/null');git(dest,'config','core.autocrlf','false');git(dest,'checkout','--detach',FIXTURE_HEAD)
 (dest/'.record-rename-phases-owned').write_text(str(ROOT)+'\n')
 keep={f'261001-record-{i:05}' for i in range(1,10001) if (i-1)%1000>=900}
 for domain in ['decisions','investigations']:
  for p in (dest/'docs'/domain).rglob('*.md'):
   if p.stem.startswith('261001-record-') and p.stem not in keep:p.unlink()
 shutil.rmtree(dest/'docs/investigations/_resources')
 git(dest,'add','docs');git(dest,'-c','user.name=Benchmark Fixture','-c','user.email=fixture@example.invalid','commit','-m','Trim independent 1k source and resource membership')
 outputs=[]
 for d,entry in ENTRIES.items():
  for command in ['sync-index']:
   argv=['node',str(ROOT/'source-before'/entry),command,'--root',str(dest)]
   p=subprocess.run(argv,cwd=dest,env=env(),capture_output=True,text=True)
   outputs.append({'argv':argv,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,(argv,p.stderr)
 git(dest,'add','docs');git(dest,'-c','user.name=Benchmark Fixture','-c','user.email=fixture@example.invalid','commit','-m','Freeze independent legal 1k phase probe')
 for d,entry in ENTRIES.items():
  argv=['node',str(ROOT/'source-before'/entry),'check','--root',str(dest)]
  p=subprocess.run(argv,cwd=dest,env=env(),capture_output=True,text=True)
  outputs.append({'argv':argv,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0 and p.stderr=='',(argv,p.stderr)
  index=json.loads((dest/'docs'/('decisions' if d=='dr' else 'investigations')/('decision-index.json' if d=='dr' else 'investigation-index.json')).read_text())
  assert len(index['entries'])==1000 and sum(len(e['relations']) for e in index['entries'].values())==900
 save('probe-manifest.json',{'head':git(dest,'rev-parse','HEAD'),'files':manifest(dest/'docs')})
 (HERE/'probe-legality.json').write_text(json.dumps(outputs,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':prepare()
