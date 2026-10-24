"""离线核对Git可恢复的归档；不访问/tmp，也不调用产品或验收被测实体。"""
import gzip,hashlib,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
def sha(data):return hashlib.sha256(data).hexdigest()
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def main():
 inv=json.loads((HERE/'archive-inventory.json').read_text());assert inv['formatVersion']==1
 ref=inv['entityAuditReference'];assert sha((HERE/ref['path']).read_bytes())==ref['sha256']
 results=(HERE/inv['resultsPath']).read_bytes();assert sha(results)==inv['resultsSHA256'];rows=[json.loads(l) for l in results.decode().splitlines()];rows=[r for r in rows if r['version'] in inv['versions']]
 bykey={tuple([r['version'],r['domain'],r['scenario'],r['round']]):r for r in rows};assert len(bykey)==len(rows)==inv['normalProductCommandCount']==inv['rawObservationJSONLRows']
 assert all(sum(r['version']==v for r in rows)==13 for v in inv['versions'])
 artifacts={a['id']:a for a in inv['artifacts']};assert len(artifacts)==len(inv['artifacts'])
 for a in artifacts.values():
  p=(HERE/a['path']).resolve();assert p.is_relative_to(HERE.resolve());data=p.read_bytes();assert len(data)==a['archivedBytes'] and sha(data)==a['archivedSHA256']
  if a['encoding'].startswith('gzip-'):assert int.from_bytes(data[4:8],'little')==0 and not data[3]&8
  original=gzip.decompress(data) if a['encoding'].startswith('gzip-') else data;assert len(original)==a['originalBytes'] and sha(original)==a['originalSHA256']
  if a['kind']=='manifest':
   m=json.loads(original);assert len(m['files'])==a['entityFileCount'];assert sha(json.dumps(m['files'],sort_keys=True,separators=(',',':')).encode())==a['entityManifestCanonicalSHA256']==m['canonicalSHA256']
 observations=inv['observations'];assert len(observations)==len(rows)
 for o in observations:
  r=bykey[tuple(o['sampleKey'])];assert sha(canonical(r))==o['originalRowCanonicalSHA256']
  for stream,ident in o['raw'].items():
   a=artifacts[ident];assert a['kind']=='raw-output' and a['originalSHA256']==r[stream]['sha256'] and a['originalBytes']==r[stream]['bytes']
 for c in inv['corrections']:
  data=(HERE/c['correctionPath']).read_bytes();assert sha(data)==c['correctionSHA256'];x=json.loads(data);r=bykey[tuple(c['sampleKey'])]
  assert x['originalRowCanonicalSHA256']==sha(canonical(r));assert x['sameProductRun'] and x['newProductInvocations']==0 and c['notANewProductCommand'];assert x['oldHarnessSHA256']==artifacts[c['oldHarnessArtifact']]['originalSHA256']
 print(json.dumps({'archiveAudit':'passed','normalProductCommandCount':len(rows),'supplementalPosteriorCorrections':len(inv['corrections']),'artifacts':len(artifacts),'scope':'archive-content-only','liveEntitiesRevalidated':False}))
if __name__=='__main__':main()
