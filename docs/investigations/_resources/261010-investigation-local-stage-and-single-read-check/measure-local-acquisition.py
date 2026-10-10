"""Current CLI acquisition audit. Fixtures and instrumentation auto-cleaned."""
import argparse, collections, hashlib, json, os, runpy, subprocess, tempfile, time
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True, help='Explicit JSON destination; never overwrites historical evidence implicitly')
arguments=parser.parse_args()
WORKSPACE=Path(__file__).resolve().parents[4]
OLD=runpy.run_path(str(WORKSPACE/'docs/investigations/_resources/261009-skill-cli-repeated-process-and-source-access/measure-process-access.py'))
COUNTER=r'''
import fs from 'node:fs';
import promises from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import cp from 'node:child_process';
const git=[];
const events=[];
function observeGit(child,args){
 if(String(args[0])!=='git')return child;
 const record={argv:args[1],stdout:'',stdin:'',callers:new Error().stack.split('\n').slice(2,7)};git.push(record);
 child.stdout?.on('data',data=>{if(record.argv.includes('ls-tree')||record.argv.includes('ls-files'))record.stdout+=data.toString();});
 if(child.stdin){const end=child.stdin.end;child.stdin.end=function(...values){if(record.argv.includes('cat-file')&&values[0]!=null)record.stdin+=values[0].toString();return end.apply(this,values);};}
 return child;
}
for(const name of ['spawn','execFile']){
 const original=cp[name];
 cp[name]=function(...args){return observeGit(original.apply(this,args),args);};
}
const original=promises.readFile;
promises.readFile=function(...args){
 const target=String(args[0]);
 if(target.startsWith(process.env.AUDIT_ROOT+'/docs/investigations/')){
  const relative=target.slice(process.env.AUDIT_ROOT.length+1);
  const stack=new Error().stack;
  events.push({path:relative,kind:relative.includes('/_resources/')?'resource':relative.endsWith('.md')?'formal':relative.endsWith('investigation-index.json')?'index':'other',callers:stack.split('\n').slice(2,7).map(x=>x.trim().replace(process.env.AUDIT_WORKSPACE,'<workspace>'))});
 }
 return original.apply(this,args);
};
syncBuiltinESMExports();
process.on('exit',()=>fs.writeFileSync(process.env.AUDIT_OUTPUT+'.'+process.pid+'.json',JSON.stringify({reads:events,git})));
'''
def compact_observation(record):
    origins=collections.Counter()
    for event in record['reads']:
        origins[(event['kind'], event['callers'][0] if event['callers'] else 'unavailable')]+=1
    io=[]
    for event in record['git_io']:
        argv=event['argv']; argv=[('<fixture>' if i==1 and argv[0]=='-C' else value) for i,value in enumerate(argv)]
        io.append(dict(argv=argv, tree_or_pending_entries=len([x for x in event['stdout'].split('\0') if x]), blob_requests=len(event['stdin'].splitlines())))
    return {**{key:value for key,value in record.items() if key not in ['reads','git_io','git_argv','stderr']}, 'read_origins':[dict(kind=key[0],caller=key[1],count=count) for key,count in sorted(origins.items())], 'git_batches':io}

def measure(base,root,args,n,k,label):
 observation=base/('observation-'+str(len(results)));observation.mkdir()
 env=dict(os.environ,AUDIT_ROOT=str(root),AUDIT_WORKSPACE=str(WORKSPACE),AUDIT_OUTPUT=str(observation/'fs'),GIT_TRACE2_EVENT=str(observation/'git.jsonl'))
 env['NODE_OPTIONS']=(env.get('NODE_OPTIONS','')+' --enable-source-maps --import='+str(base/'counter.mjs')).strip()
 begin=time.perf_counter()
 result=subprocess.run(['bun','run','investigation-report','--','--root',str(root),*args],cwd=WORKSPACE,env=env,capture_output=True,text=True)
 reads=[];git_io=[]
 for file in observation.glob('fs.*.json'):
  value=json.loads(file.read_text());reads+=value['reads'];git_io+=value['git']
 events=[json.loads(x) for x in (observation/'git.jsonl').read_text().splitlines()] if (observation/'git.jsonl').exists() else []
 commands=[e['argv'] for e in events if e['event']=='start']
 commandcounts=collections.Counter(a[3] if a[1]=='-C' else a[1] for a in commands)
 paths=collections.Counter(e['path'] for e in reads)
 record=dict(label=label,n=n,k=k,arguments=args,exit=result.returncode,git_calls=len(commands),git_commands=dict(commandcounts),read_counts=dict(collections.Counter(e['kind'] for e in reads)),paths=dict(paths),reads=reads,git_argv=commands,git_io=git_io,elapsed_single_ms=round((time.perf_counter()-begin)*1000),stderr=result.stderr if result.returncode else '')
 results.append(compact_observation(record))
 print(json.dumps({key:value for key,value in record.items() if key not in ['reads','git_argv','git_io','paths','stderr']},ensure_ascii=False),flush=True)
results=[]
with tempfile.TemporaryDirectory(prefix='ir-local-acquisition-fixtures-') as temporary:
 base=Path(temporary);(base/'counter.mjs').write_text(COUNTER)
 for n in [1,20,100]:
  root=base/f'formal-{n}'
  ids=OLD['fixture'](WORKSPACE,root,n,'formal',True)
  measure(base,root,['check'],n,n,'full-check')
  for scope in ['domain','all','index']:
   measure(base,root,['stage',ids[0],'--scope',scope],n,1,f'fixed-k-{scope}-true')
  if n in [1,20]:
   measure(base,root,['stage',*ids,'--scope','domain'],n,n,'all-k-domain-true')
   OLD['run'](['git','-C',str(root),'config','core.fileMode','false'],WORKSPACE)
   measure(base,root,['stage',ids[0],'--scope','domain'],n,1,'fixed-k-domain-false')
   measure(base,root,['stage',*ids,'--scope','domain'],n,n,'all-k-domain-false')
  if n==20:
   second=root/'docs/investigations/audit-002.md';original=second.read_text();second.write_text('broken\n')
   measure(base,root,['stage',ids[0],'--scope','domain'],n,1,'unrelated-malformed')
   second.unlink()
   measure(base,root,['stage',ids[0],'--scope','domain'],n,1,'unrelated-deleted')
   second.write_text(original)
   first=root/'docs/investigations/audit-001.md';originalfirst=first.read_text();first.write_text('broken\n')
   measure(base,root,['stage',ids[0],'--scope','domain'],n,1,'selected-malformed');first.write_text(originalfirst)
   first.write_text(originalfirst+'\n- [shared](./_resources/'+ids[1]+'/sample.txt)\n')
   OLD['cli'](WORKSPACE,'investigation-report',root,['sync-index'])
   measure(base,root,['stage',ids[0],'--scope','domain'],n,1,'necessary-owner')
   second.write_text('broken\n')
   measure(base,root,['stage',ids[0],'--scope','domain'],n,1,'necessary-owner-malformed')
  noresource=base/f'no-resource-{n}';plainids=OLD['fixture'](WORKSPACE,noresource,n,'formal',False)
  measure(base,noresource,['stage',plainids[0],'--scope','domain'],n,1,'fixed-k-no-resource')
metadata=dict(head=OLD['run'](['git','rev-parse','HEAD'],WORKSPACE).stdout.strip(),cli_sha256=hashlib.sha256((WORKSPACE/'skills/investigation-report/scripts/check-investigations.mjs').read_bytes()).hexdigest(),captured_utc=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),observations=results)
arguments.output.write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
