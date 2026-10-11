"""Isolated phase-cost audit; never writes, stages or commits the main worktree."""
import argparse, collections, hashlib, json, os, subprocess, tempfile, time
from pathlib import Path
A=argparse.ArgumentParser();A.add_argument('--profiles',type=Path);A.add_argument('--cli',type=Path,required=True);A.add_argument('--output',type=Path,required=True);args=A.parse_args()
workspace=Path.cwd();cli=args.cli.resolve();observer=Path(__file__).with_name('counter.mjs').resolve();results=[]
def run(cmd,env=None,check=True):
 r=subprocess.run(cmd,cwd=workspace,env=env,capture_output=True,text=True)
 if check and r.returncode:raise RuntimeError(str(cmd)+'\n'+r.stderr)
 return r
def cli_run(root,more,env=None,check=True):return run(['node',*(['--cpu-prof','--cpu-prof-dir='+str(args.profiles.resolve())] if env and args.profiles else []),str(cli),'--root',str(root),*more],env,check)
def fixture(root,n,r,d,blob,relation):
 directory=root/'docs/investigations';directory.mkdir(parents=True);ids=[f'261010-cost-{i:03}' for i in range(n)]
 for i,id in enumerate(ids):
  relations='[]' if not relation or i==0 or (relation=='one' and i!=n-1) else '\n'+''.join(f'  - type: "补充"\n    target: "{target}"\n' for target in [ids[0] if relation=='one' else ids[i-1]]).rstrip('\n')
  text=f'''---
title: "隔离成本样本 {i}"
id: "{id}"
formedAt: "2026-10-10T00:00:00Z"
question: "采集成本为何增长？"
tags:
  - "performance"
relations:{' ' if relations=='[]' else ''}{relations}
---

## 形成时背景
隔离样本。
## 调查目的
测量成本。
## 调查范围与依据
当前固定 CLI。
## 调查结果与边界
仅适用样本。
'''
  if i: text+='\n'+(str(i)+' unselected unique body\n')*(blob//26)
  (directory/f'cost-{i:03}.md').write_text(text)
 for i in range(d):
  owner=directory/'_resources'/ids[i%n];owner.mkdir(parents=True,exist_ok=True)
  (owner/f'root-{i:04}.bin').write_bytes(bytes([i%251])*max(1,blob))
 owner=directory/'_resources'/ids[0];owner.mkdir(parents=True,exist_ok=True)
 for i in range(r):(owner/f'flat-{i:04}.bin').write_bytes(f'unique {i}\n'.encode()+bytes([i%251])*max(1,blob))
 run(['git','init','-q',str(root)]);run(['git','-C',str(root),'config','core.fileMode','true']);cli_run(root,['sync-index'])
 run(['git','-C',str(root),'add','.']);env=dict(os.environ,GIT_AUTHOR_NAME='Fixture',GIT_AUTHOR_EMAIL='fixture@example.invalid',GIT_COMMITTER_NAME='Fixture',GIT_COMMITTER_EMAIL='fixture@example.invalid')
 run(['git','-C',str(root),'-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','commit','-q','-m','isolated phase fixture'],env)
 return ids
def measure(base,root,commands,label,inputs):
 output=base/f'observe-{len(results)}.json';env=dict(os.environ,AUDIT_ROOT=str(root),AUDIT_OUTPUT=str(output),NODE_OPTIONS='--enable-source-maps --import='+str(observer))
 started=time.perf_counter();result=cli_run(root,commands,env,False);record=json.loads(output.read_text());record['label']=label;record['inputs']=inputs;record['arguments']=commands;record['exit']=result.returncode;record['wallMs']=round((time.perf_counter()-started)*1000);record['stderr']=result.stderr[-1000:] if result.returncode else ''
 record['gitProcesses']=len(record['git']);record['gitCommands']=dict(collections.Counter(next((x for x in g['argv'] if x in ['rev-parse','ls-tree','ls-files','cat-file','config','diff','update-index','hash-object']),'other') for g in record['git']))
 record['fsReadBytes']=sum(x['bytes'] for x in record['files']);record['readdirCalls']=len(record['directories']);record['readdirReturnedEntries']=sum(x['entries'] for x in record['directories']);record['catFilePayloadBytes']=sum(g['payloadBytes'] for g in record['git']);record['catFileOutputBytes']=sum(g['outputBytes'] for g in record['git'] if 'cat-file' in g['argv']);results.append(record)
 print(json.dumps({k:record[k] for k in ['label','inputs','exit','gitProcesses','readdirCalls','readdirReturnedEntries','catFilePayloadBytes','cpuMicros','peakRSSKiB','wallMs']}),flush=True)
with tempfile.TemporaryDirectory(prefix='ir-phase-cost-') as temporary:
 base=Path(temporary)
 for label,n,r,d,blob,relation in [('P1',1,1,0,1024,False),('P20',20,1,0,1024,False),('P100',100,1,0,1024,False),('U3',1,3,0,1024,False),('B20-large',20,1,20,524288,False),('R20',1,20,0,1024,False),('R200',1,200,0,1024,False),('D20',20,1,20,1024,False),('D200',200,1,200,1024,False),('RD200',200,200,200,1024,False),('E1N100',100,1,0,524288,'one'),('E20',20,1,0,1024,True),('E100',100,1,0,1024,True)]:
  root=base/label;ids=fixture(root,n,r,d,blob,relation);inputs=dict(N=n,K=1,R=r,D=d,unselectedBlobBytes=blob,relations=1 if relation=='one' else max(0,n-1) if relation else 0)
  if relation:measure(base,root,['check'],label,inputs)
  else:

   for i in range(3 if label=='U3' else 1):
    target=root/'docs/investigations/_resources'/ids[0]/f'flat-{i:04}.bin';target.write_bytes(f'updated selected unique resource {i}\n'.encode() if label=='U3' else b'updated selected unique resource\n')
   measure(base,root,['stage',ids[0],'--scope','domain'],label,inputs)
args.output.write_text(json.dumps(dict(measuredAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),cliSHA256=hashlib.sha256(cli.read_bytes()).hexdigest(),node=run(['node','--version']).stdout.strip(),git=run(['git','--version']).stdout.strip(),samples=results),ensure_ascii=False,indent=2)+'\n')
