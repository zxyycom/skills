"""一次性归档读取模型实验的raw/manifest/harness；不复制产品源码或fixture。"""
import datetime,gzip,hashlib,io,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent;PRIVATE=pathlib.Path('/tmp/record-reader-experiment-1adb9846')
def sha(b):return hashlib.sha256(b).hexdigest()
def keep(p,b):
 p.parent.mkdir(parents=True,exist_ok=True)
 if p.exists():assert p.read_bytes()==b,('拒绝覆盖不同归档',str(p))
 else:
  with p.open('xb') as f:f.write(b)
def compress(b):
 out=io.BytesIO()
 with gzip.GzipFile(fileobj=out,mode='wb',filename='',mtime=0,compresslevel=9) as f:f.write(b)
 return out.getvalue()
def main():
 rows=[json.loads(l) for l in (HERE/'raw-results.jsonl').read_text().splitlines()];assert len(rows)==40
 artifacts=[];observations=[]
 for r in rows:
  a=r['observation']['args'];key=[r['phase'],a['contract'],a['model'],r['round']];stem='-'.join(map(str,key));raw={}
  for stream in ['stdout','stderr']:
   source=PRIVATE/'raw'/(stem+'.'+stream);b=source.read_bytes()
   if stream=='stdout':assert sha(b)==r['stdoutSHA256'] and json.loads(b)==r['observation']
   else:assert not b
   target=pathlib.Path('archived-raw')/source.name;keep(HERE/target,b);ident='raw:'+stem+':'+stream;raw[stream]=ident
   artifacts.append({'id':ident,'kind':'raw-output','path':str(target),'originalPath':str(source),'encoding':'identity','originalSHA256':sha(b),'originalBytes':len(b),'archivedSHA256':sha(b),'archivedBytes':len(b)})
  observations.append({'key':key,'originalRowCanonicalSHA256':sha(json.dumps(r,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()),'raw':raw})
 proof=json.loads((HERE/'provenance.json').read_text())
 for name,expected in [('source-manifest.json',proof['sourceManifestSHA256']),('fixture-manifest.json',proof['fixtureManifestSHA256'])]:
  source=PRIVATE/name;b=source.read_bytes();assert sha(b)==expected;m=json.loads(b);packed=compress(b);rel=pathlib.Path('provenance-manifests')/(name+'.gz');keep(HERE/rel,packed)
  artifacts.append({'id':'manifest:'+name,'kind':'manifest','path':str(rel),'originalPath':str(source),'encoding':'gzip-mtime0-filename-empty-level9','originalSHA256':sha(b),'originalBytes':len(b),'archivedSHA256':sha(packed),'archivedBytes':len(packed),'entityFileCount':len(m['files']),'entityListCanonicalSHA256':sha(json.dumps(m['files'],sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())})
 source=PRIVATE/'reader-counts-after-import.mjs';b=source.read_bytes();rel=pathlib.Path('archived-harness')/source.name;keep(HERE/rel,b)
 artifacts.append({'id':'harness:reader-counts-after-import','kind':'counting-harness','path':str(rel),'originalPath':str(source),'encoding':'identity','originalSHA256':sha(b),'originalBytes':len(b),'archivedSHA256':sha(b),'archivedBytes':len(b)})
 refs={n:sha((HERE/n).read_bytes()) for n in ['raw-results.jsonl','provenance.json','fault-results.jsonl','counts-corrected.json']}
 inventory={'formatVersion':1,'archivedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rawObservationCount':len(rows),'scope':'archived-content-only; no post-cleanup entity revalidation','references':refs,'artifacts':artifacts,'observations':observations}
 (HERE/'archive-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'observations':len(rows),'artifacts':len(artifacts),'archivedBytes':sum(a['archivedBytes'] for a in artifacts)}))
if __name__=='__main__':main()
