"""Actual Node CLI; frozen closures; posterior outside timing; append-only raw/results."""
import argparse,hashlib,importlib.util,json,os,pathlib,subprocess,time
from setup import ROOT,HERE,env,git,manifest
spec=importlib.util.spec_from_file_location('audit',HERE/'historical-audit.py');audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
ENTRIES={'dr':'skills/decision-records/scripts/decision-records.ts','ir':'skills/investigation-report/scripts/check-investigations.ts'}
def sha(b):return hashlib.sha256(b).hexdigest()
def canonical(m):return sha(json.dumps(m,sort_keys=True,separators=(',',':')).encode())
def proof(source):
 file=ROOT/(source.name+'-manifest.json');p=json.loads(file.read_text());assert manifest(source,exclude=('node_modules',))==p['files'],'frozen source drift';return canonical(p['files'])
def run(version,size,domain,scenario,mode,rep):
 fixture=ROOT/('probe' if size==1000 else 'fixture');p=json.loads((ROOT/('probe-manifest.json' if size==1000 else 'fixture-manifest.json')).read_text());head=p['head']
 assert (fixture/'.record-rename-phases-owned').read_text()==str(ROOT)+'\n';assert not git(fixture,'remote')
 git(fixture,'reset','--hard',head);git(fixture,'clean','-fd','--','docs')
 for rel,f in p['files'].items():
  q=fixture/'docs'/rel
  if f['kind']=='file':q.chmod(int(f['mode'],8))
 before=manifest(fixture/'docs');assert before==p['files'],'fixture reset mismatch'
 audit.ROOTPATH=fixture;audit.FIXTURE_HEAD=head
 source=ROOT/(('source-' if mode=='normal' else 'instrumented-')+version);digest=proof(source)
 index=audit.idx(domain);beforebytes=index.read_bytes();beforeindex=json.loads(beforebytes);assert len(beforeindex['entries'])==size,'incorrect fixture size'
 target=(index.parent/beforeindex['entries'][audit.ID]['sourcePath']).read_bytes()
 argv=['node'];stem=os.environ.get('RECORD_PHASE_ATTEMPT','')+f'{version}-{size}-{domain}-{scenario}-{mode}-{rep}';raw=HERE/'raw';raw.mkdir(exist_ok=True)
 out=raw/(stem+'.stdout');err=raw/(stem+'.stderr');trace=raw/(stem+'.trace.json');assert not out.exists() and not err.exists() and not trace.exists(),'refusing overwrite'
 e=env()
 if mode=='instrumented':argv+=['--import',str(HERE/'trace-preload.mjs')];e['RECORD_PHASE_TRACE']=str(trace)
 argv+=[str(source/ENTRIES[domain]),scenario,audit.ID]
 if scenario=='rename':argv+=[audit.NEW,'--rename-recorded-decision' if domain=='dr' else '--rename-recorded-report']
 else:argv+=['--delete-recorded']
 argv+=['--root',str(fixture)]
 started=time.monotonic_ns()
 with out.open('wb') as stdout,err.open('wb') as stderr:
  process=subprocess.Popen(argv,cwd=fixture,env=e,stdout=stdout,stderr=stderr)
  _,status,usage=os.wait4(process.pid,0);code=os.waitstatus_to_exitcode(status)
 wall=(time.monotonic_ns()-started)/1e6
 row={'sample':stem,'version':version,'size':size,'domain':domain,'scenario':scenario,'mode':mode,'rep':rep,'argv':argv,'sourceManifestSHA256':digest,'inputManifestSHA256':canonical(before),'fixtureHead':head,'inputFormalCount':len(beforeindex['entries']),'inputRelations':sum(len(x['relations']) for x in beforeindex['entries'].values()),'resourceMembers':[k for k in before if '/_resources/' in '/'+k], 'metrics':{'wallMs':wall,'userMs':usage.ru_utime*1000,'systemMs':usage.ru_stime*1000,'maxRSSKiB':usage.ru_maxrss,'exit':code},'stdout':{'path':str(out.relative_to(HERE)),'sha256':sha(out.read_bytes()),'bytes':out.stat().st_size},'stderr':{'path':str(err.relative_to(HERE)),'sha256':sha(err.read_bytes()),'bytes':err.stat().st_size}}
 try:
  assert code==0,('product exit',code,err.read_text()[:1000])
  row['posterior']=audit.verify(domain,scenario,before,beforeindex,beforebytes,target)
  row['pendingGitUnchanged']=not git(fixture,'diff','--cached','--name-only');assert row['pendingGitUnchanged']
  after=manifest(fixture/'docs');row['outputManifestSHA256']=canonical(after)
  if mode=='instrumented':
   t=json.loads(trace.read_text());assert t['open']==[];assert all('endMs'in x for x in t['events']);row['trace']={'path':str(trace.relative_to(HERE)),'sha256':sha(trace.read_bytes())}
   normal=[json.loads(x) for x in (HERE/'results.jsonl').read_text().splitlines() if json.loads(x)['sample']==stem.replace('-instrumented-', '-normal-')]
   assert len(normal)==1,'matching normal probe/sample missing';n=normal[0]
   assert n['outputManifestSHA256']==row['outputManifestSHA256'],'instrumentation output changed'
   assert n['stdout']['sha256']==row['stdout']['sha256'] and n['stderr']['sha256']==row['stderr']['sha256'],'instrumentation stdout/stderr changed'
   row['normalInstrumentedExactEquivalent']=True
 except Exception as ex:row['posteriorFailure']=repr(ex)
 with (HERE/'results.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
 print(json.dumps({'sample':stem,'metrics':row['metrics'],'ok':'posteriorFailure' not in row,'failure':row.get('posteriorFailure')},ensure_ascii=False),flush=True)
 if 'posteriorFailure'in row:raise RuntimeError(row['posteriorFailure'])
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--version',choices=['before','after'],required=True);p.add_argument('--size',type=int,choices=[1000,10000],required=True);p.add_argument('--probe',action='store_true');a=p.parse_args()
 for domain,scenario in [('dr','rename'),('ir','rename'),('dr','discard'),('ir','discard')]:
  run(a.version,a.size,domain,scenario,'normal',1)
  if not a.probe:run(a.version,a.size,domain,scenario,'normal',2)
  run(a.version,a.size,domain,scenario,'instrumented',1)
