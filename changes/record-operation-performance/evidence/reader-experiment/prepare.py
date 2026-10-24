import pathlib, hashlib, json, subprocess, re
BASE='1adb98465a7972de3517bf5128a504504419affc'
ROOT=pathlib.Path('/tmp/record-reader-experiment-1adb9846')
SOURCE=ROOT/'source'
# The caller first runs: git archive BASE tools package.json | tar -x -C SOURCE
manifest=[]
for p in sorted(SOURCE.rglob('*')):
    if p.is_file(): manifest.append({'path':str(p.relative_to(SOURCE)), 'size':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(ROOT/'source-manifest.json').write_text(json.dumps({'head':BASE,'files':manifest},indent=2)+'\n')
for name in ['source','transaction-snapshot']:
    p=SOURCE/'tools/record-operations/src'/f'{name}.ts'
    text=p.read_text().replace('"node:fs/promises"','"node:fs"')
    text=re.sub(r'\basync\s+', '', text)
    text=re.sub(r'\bawait\s+', '', text)
    for method in ['realpath','stat','lstat','open']:
        text=text.replace(f'fs.{method}(',f'fs.{method}Sync(')
    text=text.replace('handle.stat()', 'fs.fstatSync(handle)').replace('handle.readFile()', 'fs.readFileSync(handle)').replace('handle.close()', 'fs.closeSync(handle)')
    # Type annotations intentionally retain Promise signatures: Node strips them; this is an experimental mechanical transform, not product TS.
    p.with_name(f'{name}.sync.ts').write_text(text)
fixture=ROOT/'fixture'; fixture.mkdir(exist_ok=True); (fixture/'archive').mkdir(exist_ok=True)
files=[]; content_digest=hashlib.sha256()
for i in range(10000):
    rel=('archive/' if i%2 else '')+f'261024-reader-{i:05d}.md'
    text=f'---\nid: reader-{i:05d}\n---\n\n# Reader {i:05d}\n\n'+('同字节安全读取 αβγ / safe read. '*16)+'\n'
    b=text.encode(); p=fixture/rel; p.write_bytes(b); p.chmod(0o640 if i%3==0 else 0o644)
    files.append({'path':rel,'size':len(b),'sha256':hashlib.sha256(b).hexdigest(),'mode':p.stat().st_mode&0o7777,'dev':p.stat().st_dev,'ino':p.stat().st_ino})
(ROOT/'fixture-manifest.json').write_text(json.dumps({'root':str(fixture),'count':len(files),'bytes':sum(f['size'] for f in files),'files':files},indent=2)+'\n')
print(json.dumps({'source_files':len(manifest),'fixture_files':len(files),'fixture_bytes':sum(f['size'] for f in files)}))
