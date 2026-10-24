"""归档小型原始输出、完整manifest与纠正前harness；不复制被测实体。"""
import argparse,datetime,gzip,hashlib,io,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
PRIVATE=pathlib.Path('/tmp/record-end-to-end-1adb9846-20261024')
def sha(data):return hashlib.sha256(data).hexdigest()
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def keep(path,data):
 path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists():assert path.read_bytes()==data,('拒绝覆盖不同归档内容',str(path))
 else:
  with path.open('xb') as f:f.write(data)
def zipped(data):
 out=io.BytesIO()
 with gzip.GzipFile(fileobj=out,mode='wb',filename='',mtime=0,compresslevel=9) as f:f.write(data)
 return out.getvalue()
def main():
 p=argparse.ArgumentParser();p.add_argument('--versions',choices=['before','before,after'],required=True);a=p.parse_args();versions=set(a.versions.split(','))
 rows=[json.loads(l) for l in (HERE/'results.jsonl').read_text().splitlines()];rows=[r for r in rows if r['version'] in versions]
 assert all(sum(r['version']==v for r in rows)==13 for v in versions),'每个获准版本必须恰有13个命令'
 artifacts=[];observations=[]
 for row in rows:
  key=[row['version'],row['domain'],row['scenario'],row['round']];stem='-'.join(map(str,key));mapping={}
  for stream in ['stdout','stderr']:
   original=pathlib.Path(row[stream]['path']);data=original.read_bytes();assert len(data)==row[stream]['bytes'] and sha(data)==row[stream]['sha256']
   rel=pathlib.Path('archived-raw')/(stem+'.'+stream);keep(HERE/rel,data);ident='raw:'+stem+':'+stream;mapping[stream]=ident
   artifacts.append({'id':ident,'kind':'raw-output','path':str(rel),'originalPath':str(original),'encoding':'identity','originalBytes':len(data),'originalSHA256':sha(data),'archivedBytes':len(data),'archivedSHA256':sha(data)})
  observations.append({'sampleKey':key,'originalRowCanonicalSHA256':sha(canonical(row)),'raw':mapping})
 names=['source-before-manifest.json','dependencies-manifest.json','fixture-manifest.json']+(['source-after-manifest.json'] if 'after' in versions else [])
 for name in names:
  original=PRIVATE/name;data=original.read_bytes();parsed=json.loads(data);content=json.dumps(parsed['files'],sort_keys=True,separators=(',',':')).encode();assert sha(content)==parsed['canonicalSHA256']
  compressed=zipped(data);rel=pathlib.Path('provenance-manifests')/(name+'.gz');keep(HERE/rel,compressed)
  artifacts.append({'id':'manifest:'+name,'kind':'manifest','path':str(rel),'originalPath':str(original),'encoding':'gzip-mtime0-filename-empty-level9','originalBytes':len(data),'originalSHA256':sha(data),'archivedBytes':len(compressed),'archivedSHA256':sha(compressed),'entityManifestCanonicalSHA256':parsed['canonicalSHA256'],'entityFileCount':len(parsed['files'])})
 corrections=[]
 for row in rows:
  if 'posteriorFailure' not in row:continue
  key=[row['version'],row['domain'],row['scenario'],row['round']];name='posterior-correction-'+'-'.join(map(str,key))+'.json';c=json.loads((HERE/name).read_text());assert c['originalRowCanonicalSHA256']==sha(canonical(row)) and c['newProductInvocations']==0 and c['sameProductRun']
  original=pathlib.Path(c['oldHarnessCopy']);data=original.read_bytes();assert sha(data)==c['oldHarnessSHA256'];rel=pathlib.Path('archived-harness')/'measure-before-mode-correction.py';keep(HERE/rel,data)
  artifacts.append({'id':'harness:before-mode-correction','kind':'historical-harness','path':str(rel),'originalPath':str(original),'encoding':'identity','originalBytes':len(data),'originalSHA256':sha(data),'archivedBytes':len(data),'archivedSHA256':sha(data)})
  corrections.append({'sampleKey':key,'correctionPath':name,'correctionSHA256':sha((HERE/name).read_bytes()),'oldHarnessArtifact':'harness:before-mode-correction','notANewProductCommand':True})
 inv={'formatVersion':1,'archivedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'normalProductCommandCount':len(rows),'rawObservationJSONLRows':len(rows),'supplementalPosteriorCorrectionRecords':len(corrections),'versions':sorted(versions),'scope':'archived-content integrity only; not a revalidation of source/dependency/fixture entities after cleanup','resultsPath':'results.jsonl','resultsSHA256':sha((HERE/'results.jsonl').read_bytes()),'entityAuditReference':{'path':'audit.json','sha256':sha((HERE/'audit.json').read_bytes()),'meaning':'Historical live-entity audit; offline archive audit does not repeat it'},'artifacts':artifacts,'observations':observations,'corrections':corrections}
 (HERE/'archive-inventory.json').write_text(json.dumps(inv,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'commands':len(rows),'artifacts':len(artifacts),'archivedBytes':sum(x['archivedBytes'] for x in artifacts),'manifests':len(names)}))
if __name__=='__main__':main()
