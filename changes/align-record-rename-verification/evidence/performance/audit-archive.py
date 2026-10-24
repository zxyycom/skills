"""Verify Git-recovered evidence without retained /tmp, product execution or dependencies."""
import collections,gzip,hashlib,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
canonical=lambda v:sha(json.dumps(v,sort_keys=True,separators=(',',':')).encode())
def audit():
 inventory=json.loads((HERE/'archive-inventory.json').read_text())
 for rel,f in inventory['files'].items():
  p=HERE/rel;assert p.is_file() and p.stat().st_size==f['bytes'] and sha(p.read_bytes())==f['sha256'],rel
 manifests={p.name.removesuffix('.json.gz'):json.loads(gzip.decompress(p.read_bytes())) for p in (HERE/'manifests').glob('*.json.gz')}
 facts=json.loads((HERE/'audit.json').read_text())
 for name,f in facts['immutability'].items():assert canonical(manifests[name]['files'])==f['canonicalSHA256']
 rows=[json.loads(x) for x in (HERE/'results.jsonl').read_text().splitlines()]
 for row in rows:
  assert row['metrics']['exit']==0 and 'posteriorFailure' not in row
  source=('source-' if row['mode']=='normal' else 'instrumented-')+row['version'];assert canonical(manifests[source]['files'])==row['sourceManifestSHA256']
  for stream in ['stdout','stderr','trace']:
   if stream in row:assert sha((HERE/row[stream]['path']).read_bytes())==row[stream]['sha256']
  if 'trace'in row:
   trace=json.loads((HERE/row['trace']['path']).read_text());assert not trace['open'];assert all(x['startMs']<=x['endMs'] for x in trace['events'])
   normal=[x for x in rows if (x['version'],x['size'],x['domain'],x['scenario'],x['mode'],x['rep'])==(row['version'],row['size'],row['domain'],row['scenario'],'normal',1)];assert len(normal)==1
   n=normal[0];assert n['outputManifestSHA256']==row['outputManifestSHA256'];assert n['stdout']['sha256']==row['stdout']['sha256'] and n['stderr']['sha256']==row['stderr']['sha256']
 formal=collections.Counter((r['version'],r['domain'],r['scenario'],r['mode']) for r in rows if r['size']==10000)
 for v in {r['version'] for r in rows}:
  for d in ['dr','ir']:
   for operation in ['rename','discard']:
    assert formal[v,d,operation,'normal']==2 and formal[v,d,operation,'instrumented']==1
  probes=[r for r in rows if r['version']==v and r['size']==1000];assert len(probes)==8
 recipe=json.loads(gzip.decompress((HERE/'fixture-recipe.json.gz').read_bytes()));assert len(recipe['files'])==20007
 assert sha((HERE/'fixture-recipe.json.gz').read_bytes())==facts['fixtureRecipeSHA256']
 for v in {r['version'] for r in rows}:
  closure=json.loads((HERE/('import-closure-'+v+'.json')).read_text());assert closure['noResolvedScopeEscape'] and closure['allDynamicImportsLiteral']
 print(json.dumps({'archiveFiles':len(inventory['files']),'acceptedSamples':len(rows),'formalSamples':sum(formal.values()),'rawSourceDependencyManifestHashesVerified':True,'normalInstrumentedOutputEquivalenceVerified':True,'noTmpRequired':True}))
if __name__=='__main__':audit()
