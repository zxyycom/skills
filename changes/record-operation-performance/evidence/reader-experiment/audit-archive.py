"""只读离线归档校验；不访问/tmp，不调用reader或产品CLI。"""
import gzip,hashlib,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 inv=json.loads((HERE/'archive-inventory.json').read_text());assert inv['formatVersion']==1
 for name,digest in inv['references'].items():assert sha((HERE/name).read_bytes())==digest
 rows=[json.loads(l) for l in (HERE/'raw-results.jsonl').read_text().splitlines()];assert len(rows)==inv['rawObservationCount']==40
 bykey={(r['phase'],r['observation']['args']['contract'],r['observation']['args']['model'],r['round']):r for r in rows};assert len(bykey)==40
 artifacts={a['id']:a for a in inv['artifacts']};assert len(artifacts)==len(inv['artifacts'])
 for a in artifacts.values():
  p=(HERE/a['path']).resolve();assert p.is_relative_to(HERE.resolve());b=p.read_bytes();assert len(b)==a['archivedBytes'] and sha(b)==a['archivedSHA256']
  if a['encoding'].startswith('gzip-'):
   assert int.from_bytes(b[4:8],'little')==0 and not b[3]&8;b=gzip.decompress(b)
  assert len(b)==a['originalBytes'] and sha(b)==a['originalSHA256']
  if a['kind']=='manifest':
   m=json.loads(b);assert len(m['files'])==a['entityFileCount'] and sha(json.dumps(m['files'],sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())==a['entityListCanonicalSHA256']
 for o in inv['observations']:
  r=bykey[tuple(o['key'])];assert sha(json.dumps(r,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())==o['originalRowCanonicalSHA256']
  assert artifacts[o['raw']['stdout']]['originalSHA256']==r['stdoutSHA256']
  actual=json.loads((HERE/artifacts[o['raw']['stdout']]['path']).read_bytes());assert actual==r['observation'] and r['exit']==0 and actual['posterior']
 faults=[json.loads(l) for l in (HERE/'fault-results.jsonl').read_text().splitlines()];assert len(faults)==48 and all(x['exit']==0 and x['result']['rejected'] for x in faults)
 corrected=json.loads((HERE/'counts-corrected.json').read_text())['observations'];assert len(corrected)==2
 for x in corrected:
  c=x['observation']['args']['contract'];ref=next(r['observation']['counts'] for r in rows if r['phase']=='counts-1k' and r['observation']['args']['contract']==c and r['observation']['args']['model']=='A');assert x['observation']['counts']==ref
 print(json.dumps({'archiveAudit':'passed','observations':40,'faultRejections':48,'correctedCounts':2,'artifacts':len(artifacts),'scope':'archive-content-only','liveEntitiesRevalidated':False}))
if __name__=='__main__':main()
