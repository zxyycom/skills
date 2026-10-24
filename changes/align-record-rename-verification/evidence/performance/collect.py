"""Small archived collector; evidence checks do not execute product commands."""
import datetime,gzip,hashlib,json,os,pathlib,platform,subprocess,collections
from setup import ROOT,HERE,manifest

def sha(b):return hashlib.sha256(b).hexdigest()
def canon(x):return sha(json.dumps(x,sort_keys=True,separators=(',',':')).encode())
def collect():
 rows=[json.loads(x) for x in (HERE/'results.jsonl').read_text().splitlines()];checks=[];summaries=[]
 for row in rows:
  assert 'posteriorFailure' not in row,row['sample'];assert row['metrics']['exit']==0
  for stream in ['stdout','stderr','trace']:
   if stream not in row:continue
   item=row[stream];p=HERE/item['path'];assert sha(p.read_bytes())==item['sha256'],p
  phases={};exclusive={};trace=None
  if 'trace'in row:
   trace=json.loads((HERE/row['trace']['path']).read_text());assert trace['open']==[]
   for e in trace['events']:
    duration=e['endMs']-e['startMs'];assert duration>=0
    children=[x for x in trace['events'] if x['parent']==e['id']]
    for child in children:assert e['startMs']<=child['startMs']<=child['endMs']<=e['endMs']
    children.sort(key=lambda x:x['startMs'])
    for first,second in zip(children,children[1:]):assert first['endMs']<=second['startMs']
    own=duration-sum(x['endMs']-x['startMs'] for x in children);assert own>=-0.001
    phases[e['label']]=phases.get(e['label'],0)+duration;exclusive[e['label']]=exclusive.get(e['label'],0)+own
   phases['freshPlusSharedPreverify']=phases.get('domain.fresh',0)+phases.get('shared.preverify',0)
   phases['sharedPlusDomainPostverify']=phases.get('shared.postverify',0)+phases.get('domain.postverify',0)
   stages=['shared.prepare','domain.fresh','shared.preverify','write.loop','resources.apply','publish','shared.postverify','domain.postverify','cleanup']
   phases['externalAndUnattributedResidual']=row['metrics']['wallMs']-sum(phases.get(k,0) for k in stages)
  summaries.append({k:row[k] for k in ['sample','version','size','domain','scenario','mode','rep','metrics','inputFormalCount','inputRelations','inputManifestSHA256','outputManifestSHA256']}|{'inclusiveMs':phases,'exclusiveByInstrumentedFunctionMs':exclusive,'plannedWrites':next((e.get('metadata') for e in (trace or {}).get('events',[]) if e['label']=='write.loop'),None),'actualDocumentDeltaCount':len([p for p in row['posterior']['delta'] if not p.endswith('.json')]),'actualIndexDeltaCount':len([p for p in row['posterior']['delta'] if p.endswith('.json')])})
  checks.append({'sample':row['sample'],'rawHashesVerified':True,'posteriorPassed':True,'intervalNestingVerified':trace is not None,'normalInstrumentedExactEquivalent':row.get('normalInstrumentedExactEquivalent')})
 (HERE/'summary.json').write_text(json.dumps(summaries,ensure_ascii=False,indent=2)+'\n')
 proofdir=HERE/'manifests';proofdir.mkdir(exist_ok=True);immutability={}
 for name in ['source-before','source-after','instrumented-before','instrumented-after','dependencies','fixture','probe']:
  p=ROOT/(name+'-manifest.json')
  if not p.exists():continue
  value=json.loads(p.read_text())
  if name in ['source-before','source-after','instrumented-before','instrumented-after','dependencies']:
   src=ROOT/('dependencies/node_modules' if name=='dependencies' else name);actual=manifest(src,exclude=('node_modules',) if name!='dependencies' else ())
   assert actual==value['files'],name+' changed';immutability[name]={'verified':True,'canonicalSHA256':canon(actual),'fileCount':len(actual)}
  archive=proofdir/(name+'.json.gz');archive.write_bytes(gzip.compress(p.read_bytes(),mtime=0))
 audit={'collectedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'samples':checks,'immutability':immutability,'fixtureRecipeSHA256':sha((HERE/'fixture-recipe.json.gz').read_bytes()),'fixtureReproduction':{'verifiedBeforeSampling':True,'originalHead':'9fdb438df1f4e33722cf6eb131983ba071930d75','files':20007},'normalRows':sum(x['mode']=='normal' for x in rows),'instrumentedRows':sum(x['mode']=='instrumented' for x in rows),'failureEvidenceSeparate':'probe-attempt1-results.jsonl / probe-attempt1-legality.json; instrument syntax failure and DR9100-size defect excluded from performance results'}
 (HERE/'audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
 if not (HERE/'environment.json').exists():
  node=subprocess.check_output(['node','-p','JSON.stringify({execPath:process.execPath,versions:process.versions,arch:process.arch,platform:process.platform})']).decode();exe=json.loads(node)['execPath']
  environment={'node':json.loads(node),'nodeExecutableSHA256':sha(pathlib.Path(exe).read_bytes()),'os':platform.uname()._asdict(),'cpuAffinity':sorted(os.sched_getaffinity(0)),'cpuModel':next((x.split(':',1)[1].strip() for x in pathlib.Path('/proc/cpuinfo').read_text().splitlines() if x.startswith('model name')),None),'gitVersion':subprocess.check_output(['git','--version']).decode().strip(),'filesystem':subprocess.check_output(['df','-T',str(ROOT)]).decode(),'sampling':'same Node/dependency bytes; no cache drop; each operation starts a fresh Node process including launch/import and worker startup; reset/hash/audit excluded from wall; local project agents quiet but unrelated workspace load not controllable','environmentOverrides':{'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_TERMINAL_PROMPT':'0','TZ':'UTC','NODE_OPTIONS':'removed','NODE_PATH':'removed'},'cpuMetrics':'os.wait4 direct Node child rusage, including process worker threads; not per-stage CPU; no syscall counts'}
  (HERE/'environment.json').write_text(json.dumps(environment,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'samples':len(rows),'immutability':{k:v['verified'] for k,v in immutability.items()},'allPassed':True}))
if __name__=='__main__':collect()
