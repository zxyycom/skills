"""仅校验/汇总已完成样本，不调用产品CLI。"""
import argparse,collections,hashlib,json,pathlib,statistics,datetime
from setup import ROOT,HERE,manifest
p=argparse.ArgumentParser();p.add_argument('--expect-before',type=int,default=None);p.add_argument('--expect-after',type=int,default=None);a=p.parse_args()
rows=[json.loads(l) for l in (HERE/'results.jsonl').read_text().splitlines()];original_failures=sum('posteriorFailure' in r for r in rows);corrections=[]
for r in rows:
 if 'posteriorFailure' not in r:continue
 key=[r['version'],r['domain'],r['scenario'],r['round']];path=HERE/('posterior-correction-'+'-'.join(map(str,key))+'.json');c=json.loads(path.read_text())
 assert c['sampleKey']==key and c['sameProductRun'] and c['newProductInvocations']==0
 assert c['originalRowCanonicalSHA256']==hashlib.sha256(json.dumps(r,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
 r['posterior']=c['posterior'];r['posteriorCorrectionPath']=str(path);del r['posteriorFailure'];corrections.append(str(path))
groups=collections.defaultdict(list);seen=set();inputs=collections.defaultdict(set)
for r in rows:
 key=(r['version'],r['domain'],r['scenario'],r['round']);assert key not in seen,key;seen.add(key)
 for name in ['stdout','stderr']:
  f=pathlib.Path(r[name]['path']);b=f.read_bytes();assert len(b)==r[name]['bytes'] and hashlib.sha256(b).hexdigest()==r[name]['sha256']
 assert r['metrics']['exit']==0 and 'posterior' in r and 'posteriorFailure' not in r,key
 assert r['posterior']['completeExpectedIndexEqual'] and r['posterior']['allSourceRevisionFingerprintsMatch']
 groups[(r['domain'],r['scenario'],r['version'])].append(r)
 inputs[(r['domain'],r['scenario'])].add(r['inputDocsManifestSHA256'])
assert all(len(v)==1 for v in inputs.values()),'paired inputs differ'
for version,wanted in [('before',a.expect_before),('after',a.expect_after)]:
 n=sum(r['version']==version for r in rows)
 if wanted is not None:assert n==wanted,(version,n,wanted)
 for domain in ['dr','ir']:
  if n:assert any(r['version']==version and r['domain']==domain and r['scenario']=='check' for r in rows),'missing measured check'
for version in {r['version'] for r in rows}:
 source=ROOT/('source-before' if version=='before' else 'source-after');proof=json.loads((ROOT/(source.name+'-manifest.json')).read_text());assert manifest(source,exclude=('node_modules',))==proof['files']
proof=json.loads((ROOT/'dependencies-manifest.json').read_text());assert manifest(ROOT/'dependencies/node_modules')==proof['files'],'frozen dependencies changed'
lines=['| 域/场景 | 版本 | wall全部ms | user中位ms | system中位ms | RSS全部KiB |','| --- | --- | --- | --- | --- | --- |']
for key,rs in sorted(groups.items()):
 d,s,v=key;m=[r['metrics'] for r in rs];wall=', '.join(format(x['wallMs'],'.1f') for x in m);lines.append(f"| {d}/{s} | {v} | {wall} | {statistics.median(x['userMs'] for x in m):.1f} | {statistics.median(x['systemMs'] for x in m):.1f} | {', '.join(str(x['maxRSSKiB']) for x in m)} |")
(HERE/'summary-table.md').write_text('\n'.join(lines)+'\n')
(HERE/'audit.json').write_text(json.dumps({'auditedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sampleCount':len(rows),'rawObservationJSONLRows':len(rows),'normalProductCommandCount':len(rows),'supplementalPosteriorCorrectionRecords':len(corrections),'beforeCount':sum(r['version']=='before' for r in rows),'afterCount':sum(r['version']=='after' for r in rows),'allRawHashesMatch':True,'allPairedInputsMatch':True,'allAcceptedPosteriorsPass':True,'originalPosteriorFailureCount':original_failures,'sameRunPosteriorCorrections':corrections,'frozenSourcesAndDependenciesUnchanged':True,'extraExternalFullChecks':0,'measuredReadOnlyChecks':sum(r['scenario']=='check' for r in rows)},ensure_ascii=False,indent=2)+'\n')
print('\n'.join(lines))
