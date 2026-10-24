"""实际分发CLI；只接纳有本轮ownership marker的私有fixture。"""
import argparse,copy,hashlib,json,os,pathlib,re,subprocess,time
from setup import ROOT,HERE,BASE,FIXTURE_HEAD,env,git,manifest
ID='261001-record-10000';NEW='261001-renamed-record';ROOTPATH=ROOT/'fixture'
COMMANDS={'check':['check'],'sync-selected':['sync-index','--select',ID],'sync-full':['sync-index'],'rename':['rename',ID,NEW],'discard':['discard',ID,'--delete-recorded']}
ENTRIES={'dr':pathlib.Path('skills/decision-records/scripts/decision-records.ts'),'ir':pathlib.Path('skills/investigation-report/scripts/check-investigations.ts')}
COLLECTIONS={'dr':'decisions','ir':'investigations'}
def hashbytes(b):return hashlib.sha256(b).hexdigest()
def fingerprint(label,*fields):
 b=label.encode()+b'\0'
 for f in fields:
  f=f.encode();b+=str(len(f)).encode()+b':'+f+b'\0'
 return 'sha256:'+hashbytes(b)
def idx(domain):return ROOTPATH/'docs'/COLLECTIONS[domain]/('decision-index.json' if domain=='dr' else 'investigation-index.json')
def reset(domain,scenario):
 assert ROOTPATH==ROOT/'fixture' and (ROOTPATH/'.record-end-to-end-owned').read_text()==str(ROOT)+'\n'
 git(ROOTPATH,'reset','--hard',FIXTURE_HEAD);git(ROOTPATH,'clean','-fd','--','docs')
 frozen=json.loads((ROOT/'fixture-manifest.json').read_text())['files'];actual=manifest(ROOTPATH/'docs')
 assert actual.keys()==frozen.keys(),'reset membership'
 for rel,f in frozen.items():
  assert actual[rel]['sha256']==f['sha256'] and actual[rel]['bytes']==f['bytes'],('reset bytes',rel)
  if actual[rel]['mode']!=f['mode']:(ROOTPATH/'docs'/rel).chmod(int(f['mode'],8))
 if scenario.startswith('sync'):
  p=idx(domain).parent/(ID+'.md');old=p.read_bytes();new=old.replace(b'benchmark 261001-record-10000',b'benchmark edited-record-10000',1);assert new!=old;p.write_bytes(new)
 assert git(ROOTPATH,'rev-parse','HEAD')==FIXTURE_HEAD and not git(ROOTPATH,'remote')
 return manifest(ROOTPATH/'docs')
def verify(domain,scenario,before,before_index,before_index_bytes,before_target):
 after=manifest(ROOTPATH/'docs');delta=sorted(k for k in set(before)|set(after) if before.get(k)!=after.get(k));prefix=COLLECTIONS[domain]+'/'
 index=idx(domain);actual=json.loads(index.read_text());expected=copy.deepcopy(before_index)
 old_entry=before_index['entries'][ID];entry=dict(old_entry)
 selected_old_path=old_entry['sourcePath'];selected_new_path=selected_old_path
 if scenario.startswith('sync'):
  entry['title']='benchmark edited-record-10000';expected['entries'][ID]=entry
 elif scenario=='rename':
  selected_new_path='renamed-record.md';entry.update(name='renamed-record',sourcePath=selected_new_path)
  del expected['entries'][ID];expected['entries'][NEW]=entry;del expected['sourceRevision']['entries'][ID]
 elif scenario=='discard':
  del expected['entries'][ID];del expected['sourceRevision']['entries'][ID]
 if scenario!='check' and scenario!='discard':
  ident=NEW if scenario=='rename' else ID;text=(index.parent/selected_new_path).read_text(encoding='utf8');normalized=text.replace('\r\n','\n') if domain=='dr' else re.sub(r'\r\n?', '\n',text)
  expected['sourceRevision']['entries'][ident]=fingerprint(('decision' if domain=='dr' else 'investigation')+'-index-entry-v2',ident,selected_new_path,normalized)
 assert actual==expected,('complete expected index mismatch',domain,scenario)
 count=9999 if scenario=='discard' else 10000;edges=8999 if scenario=='discard' else 9000
 assert len(actual['entries'])==count and set(actual['sourceRevision']['entries'])==set(actual['entries'])
 assert sum(len(e['relations']) for e in actual['entries'].values())==edges
 meta_label='decision-index-metadata-v2' if domain=='dr' else 'investigation-index-metadata-v4'
 assert actual['sourceRevision']['metadata']==fingerprint(meta_label,'{}') and actual['metadata']=={}
 allowed=set() if scenario=='check' else {prefix+index.name}
 if scenario in ['rename','discard']:allowed.add(prefix+selected_old_path)
 if scenario=='rename':allowed.add(prefix+selected_new_path)
 assert set(delta)==allowed,('exact delta',delta,allowed)
 if scenario!='check':assert after[prefix+index.name]['mode']==before[prefix+index.name]['mode'],'existing index mode preservation'
 for rel in (set(before)&set(after))-allowed:assert before[rel]==after[rel],('unselected bytes/mode',rel)
 # All resulting entries: actual source ID/locator, sourceRevision fingerprint, relation target closure and exact sparse fixture graph.
 for ident,e in actual['entries'].items():
  data=(index.parent/e['sourcePath']).read_bytes();text=data.decode('utf8',errors='strict');parts=text.split('---',2);assert len(parts)==3
  declared=[line.split(':',1)[1].strip().strip('"\'') for line in parts[1].splitlines() if line.startswith('id:')];assert declared==[ident],('frontmatter ID',ident,declared)
  normalized=text.replace('\r\n','\n') if domain=='dr' else re.sub(r'\r\n?','\n',text)
  assert actual['sourceRevision']['entries'][ident]==fingerprint(('decision' if domain=='dr' else 'investigation')+'-index-entry-v2',ident,e['sourcePath'],normalized),('fingerprint',ident)
  for edge in e['relations']:assert edge['target'] in actual['entries'],('dangling relation',ident)
  origin=ID if ident==NEW else ident;i=int(origin.rsplit('-',1)[1]);want=[] if i<=1000 else [{'type':'修订' if domain=='dr' else '补充','target':f'261001-record-{i-1000:05}'}]
  assert e['relations']==want,('exact sparse relation',ident)
 if scenario=='rename':
  assert not (index.parent/selected_old_path).exists()
  text=(index.parent/selected_new_path).read_bytes();before_body=before_target.split(b'---',2)[2];after_body=text.split(b'---',2)[2]
  assert before_body==after_body,'rename body preservation'
  header=text.decode('utf8').split('---',2)[1]
  for key in ['title','status','alignment','createdAt','purpose','background','decision','formedAt','question']:
   if key not in entry:continue
   values=[line.split(':',1)[1].strip() for line in header.splitlines() if line.startswith(key+':')]
   assert len(values)==1,('renamed scalar uniqueness',key)
   value=values[0]
   value=json.loads(value) if value.startswith(chr(34)) else value.strip(chr(39)).replace(chr(39)*2,chr(39))
   assert value==entry[key],('renamed metadata preservation',key,value,entry[key])
  mode=oct((index.parent/selected_new_path).stat().st_mode&0o7777)
  assert mode==(before[prefix+selected_old_path]['mode'] if domain=='dr' else '0o600'),('rename representation mode',mode)
 elif scenario=='discard':assert not (index.parent/selected_old_path).exists()
 assert git(ROOTPATH,'rev-parse','HEAD')==FIXTURE_HEAD and not git(ROOTPATH,'diff','--cached','--name-only')
 text_exact=None
 if scenario.startswith('sync'):
  b=before_index_bytes.replace(b'benchmark 261001-record-10000',b'benchmark edited-record-10000',1)
  b=b.replace(before_index['sourceRevision']['entries'][ID].encode(),actual['sourceRevision']['entries'][ID].encode(),1)
  text_exact=b==index.read_bytes()
 return {'allEntriesVerified':count,'relationCount':edges,'allUnselectedBytesModesEntriesRevisionPreserved':True,'allSourceRevisionFingerprintsMatch':True,'completeExpectedIndexEqual':True,'syncEntireIndexTextExact':text_exact,'delta':{k:{'before':before.get(k),'after':after.get(k)} for k in delta},'afterIndexSHA256':hashbytes(index.read_bytes()),'afterDocsManifestSHA256':hashbytes(json.dumps(after,sort_keys=True,separators=(',',':')).encode())}
def source_proof(version):
 source=ROOT/('source-before' if version=='before' else 'source-after');name=source.name+'-manifest.json';proof=json.loads((ROOT/name).read_text())
 assert manifest(source,exclude=('node_modules',))==proof['files'],'frozen source changed'
 return source,proof['canonicalSHA256']
def run(version,domain,scenario,round):
 source,digest=source_proof(version);before=reset(domain,scenario);index=idx(domain);before_index_bytes=index.read_bytes();before_index=json.loads(before_index_bytes);before_target=(index.parent/before_index['entries'][ID]['sourcePath']).read_bytes()
 argv=['node',str(source/ENTRIES[domain]),*COMMANDS[scenario]]
 if scenario=='rename':argv.append('--rename-recorded-decision' if domain=='dr' else '--rename-recorded-report')
 argv+=['--root',str(ROOTPATH)]
 stem=f'{version}-{domain}-{scenario}-{round}';raw=ROOT/'raw';raw.mkdir(exist_ok=True)
 out=raw/(stem+'.stdout');err=raw/(stem+'.stderr')
 assert not out.exists() and not err.exists(),'拒绝覆盖先前样本'
 started=time.monotonic_ns()
 with out.open('wb') as stdout,err.open('wb') as stderr:
  p=subprocess.Popen(argv,cwd=ROOTPATH,env=env(),stdout=stdout,stderr=stderr)
  _,status,usage=os.wait4(p.pid,0);code=os.waitstatus_to_exitcode(status)
 metrics={'wallMs':(time.monotonic_ns()-started)/1e6,'userMs':usage.ru_utime*1000,'systemMs':usage.ru_stime*1000,'maxRSSKiB':usage.ru_maxrss,'exit':code}
 row={'version':version,'domain':domain,'scenario':scenario,'round':round,'argv':argv,'sourceManifestSHA256':digest,'inputDocsManifestSHA256':hashbytes(json.dumps(before,sort_keys=True,separators=(',',':')).encode()),'fixtureHead':FIXTURE_HEAD,'metrics':metrics,'stdout':{'path':str(out),'bytes':out.stat().st_size,'sha256':hashbytes(out.read_bytes())},'stderr':{'path':str(err),'bytes':err.stat().st_size,'sha256':hashbytes(err.read_bytes())}}
 try:
  assert code==0,('product exit',code,err.read_text()[:4000])
  row['posterior']=verify(domain,scenario,before,before_index,before_index_bytes,before_target)
 except Exception as e:row['posteriorFailure']=repr(e)
 with (HERE/'results.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
 print(json.dumps({'sample':stem,'metrics':metrics,'posterior':not row.get('posteriorFailure'),'failure':row.get('posteriorFailure')},ensure_ascii=False),flush=True)
 if 'posteriorFailure' in row:raise RuntimeError(row['posteriorFailure'])
def help_proof(version):
 source,digest=source_proof(version);rows=[]
 for domain,commands in [('dr',['check','sync-index','rename']),('ir',['check','sync-index','rename','discard'])]:
  for command in commands:
   argv=['node',str(source/ENTRIES[domain]),'help',command];p=subprocess.run(argv,env=env(),capture_output=True,text=True,cwd=ROOTPATH)
   rows.append({'argv':argv,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,(argv,p.stderr)
 (HERE/f'help-{version}.json').write_text(json.dumps({'sourceManifestSHA256':digest,'commands':rows},ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--version',choices=['before','after'],required=True);p.add_argument('--stage',choices=['help','checks','sync','strict'],required=True);a=p.parse_args();os.umask(0o002)
 if a.stage=='help':help_proof(a.version)
 elif a.stage=='checks':
  for d in ['dr','ir']:run(a.version,d,'check',1)
 elif a.stage=='sync':
  for r in range(1,4):
   for d in (['dr','ir'] if r%2 else ['ir','dr']):run(a.version,d,'sync-selected',r)
  for d in ['dr','ir']:run(a.version,d,'sync-full',1)
 elif a.stage=='strict':
  for d,s in [('dr','rename'),('ir','rename'),('ir','discard')]:run(a.version,d,s,1)
