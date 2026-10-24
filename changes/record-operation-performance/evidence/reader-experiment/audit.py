import pathlib,json,hashlib,collections,statistics,subprocess,platform,datetime
HERE=pathlib.Path(__file__).parent;BASE=pathlib.Path('/tmp/record-reader-experiment-1adb9846')
sha=lambda b:hashlib.sha256(b).hexdigest()
rows=[json.loads(l) for l in (HERE/'raw-results.jsonl').read_text().splitlines()]
assert len(rows)==40,len(rows)
faults=[json.loads(l) for l in (HERE/'fault-results.jsonl').read_text().splitlines()]
assert len(faults)==48 and all(r['exit']==0 and r['result']['rejected'] for r in faults)
corrected=json.loads((HERE/'counts-corrected.json').read_text())['observations']
for r in corrected:
 c=r['observation']['args']['contract'];ref=next(x['observation']['counts'] for x in rows if x['phase']=='counts-1k' and x['observation']['args']['contract']==c and x['observation']['args']['model']=='A')
 assert r['observation']['counts']==ref
for r in rows:
 assert r['exit']==0 and r['observation']['posterior']
 stem=f"{r['phase']}-{r['observation']['args']['contract']}-{r['observation']['args']['model']}-{r['round']}"
 assert sha((BASE/'raw'/f'{stem}.stdout').read_bytes())==r['stdoutSHA256']
for (phase,contract),group in __import__('itertools').groupby(sorted(rows,key=lambda r:(r['phase'],r['observation']['args']['contract'])),lambda r:(r['phase'],r['observation']['args']['contract'])):
 g=list(group);assert len({r['observation']['summary']['resultSHA256'] for r in g})==1,(phase,contract)
manifest=json.loads((BASE/'source-manifest.json').read_text())
for f in manifest['files']:assert sha((BASE/'source'/f['path']).read_bytes())==f['sha256'],f['path']
fixtures=json.loads((BASE/'fixture-manifest.json').read_text())
for f in fixtures['files']:
 p=pathlib.Path(fixtures['root'])/f['path'];s=p.stat()
 assert sha(p.read_bytes())==f['sha256'] and s.st_mode&0o7777==f['mode'] and (s.st_dev,s.st_ino)==(f['dev'],f['ino'])
closure=['tools/record-operations/src/source.ts','tools/record-operations/src/transaction-snapshot.ts','tools/shared/src/node/filesystem.ts']
provenance={'head':manifest['head'],'sourceArchiveFileCount':len(manifest['files']),'sourceManifestSHA256':sha((BASE/'source-manifest.json').read_bytes()),'runtimeClosure':[{**f,'gitBlobSHA256':sha(subprocess.check_output(['git','show',manifest['head']+':'+f['path']]))} for f in manifest['files'] if f['path'] in closure],'fixtureManifestSHA256':sha((BASE/'fixture-manifest.json').read_bytes()),'fixtureCount':fixtures['count'],'fixtureBytes':fixtures['bytes'],'fixtureDistribution':{'root':5000,'archive':5000,'bytesPerFile':715,'mode0640':3334,'mode0644':6666},'posterior':{'sampleCount':len(rows),'allExit0':True,'allPerFileReturnedBytesMatchInitialManifest':True,'allPerContractResultsEqualAcrossModelsAndRepeats':True,'finalSourceArchiveAndFixtureUnchanged':True},'prototypeSHA256':{p.name:sha(p.read_bytes()) for p in HERE.iterdir() if p.suffix in ['.py','.mjs']},'syncDerivatives':{p.name:sha(p.read_bytes()) for p in (BASE/'source/tools/record-operations/src').glob('*.sync.ts')},'platform':platform.platform(),'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat()}
assert all(f['sha256']==f['gitBlobSHA256'] for f in provenance['runtimeClosure'])
(HERE/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
lines=['| 合同 | 模型 | wall 三次 ms | 中位 user/system ms | maxRSS 三次 KiB |','| --- | --- | --- | --- | --- |']
for contract in ['text','snapshot']:
 for model in ['A','B4','B8','C']:
  ms=[r['observation']['metrics'] for r in rows if r['phase']=='warm-10k' and r['observation']['args']['contract']==contract and r['observation']['args']['model']==model]
  lines.append(f"| {contract} | {model} | {', '.join(str(round(m['wallMs'],1)) for m in ms)} | {statistics.median(m['userMs'] for m in ms):.1f} / {statistics.median(m['systemMs'] for m in ms):.1f} | {', '.join(str(m['maxRSSKiB']) for m in ms)} |")
(HERE/'summary-table.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines))
