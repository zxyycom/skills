import pathlib,subprocess,json
out=pathlib.Path(__file__).with_name('fault-results.jsonl')
for contract in ['text','snapshot']:
 for model in ['A','B4','C']:
  for kind in ['leaf-symlink','parent-symlink','root-alias','invalid-utf8','escape','directory','missing','revision-drift']:
   p=subprocess.run(['node',str(pathlib.Path(__file__).with_name('fault-probe.mjs').resolve()),model,contract,kind],capture_output=True,text=True)
   with out.open('a') as f:f.write(json.dumps({'exit':p.returncode,'stderr':p.stderr,'result':json.loads(p.stdout) if p.stdout else None})+'\n')
   if p.returncode: print('FAIL',model,contract,kind,p.stdout,p.stderr,flush=True)
print('fault probes complete',flush=True)
