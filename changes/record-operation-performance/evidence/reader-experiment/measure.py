import subprocess,json,pathlib,time,hashlib
ROOT=pathlib.Path('/tmp/record-reader-experiment-1adb9846');RAW=ROOT/'raw';RAW.mkdir(exist_ok=True)
SCRIPT=pathlib.Path(__file__).with_name('reader.mjs').resolve(); OUTPUT=pathlib.Path(__file__).with_name('raw-results.jsonl')
rows=[]
def run(model,contract,n,counting,phase,round):
    argv=['node',str(SCRIPT),model,contract,str(n),str(counting).lower()]
    start=time.time();p=subprocess.run(argv,text=True,capture_output=True);elapsed=time.time()-start
    stem=f'{phase}-{contract}-{model}-{round}';(RAW/(stem+'.stdout')).write_text(p.stdout);(RAW/(stem+'.stderr')).write_text(p.stderr)
    row={'phase':phase,'round':round,'argv':argv,'exit':p.returncode,'processWallMs':elapsed*1000,'stdoutSHA256':hashlib.sha256(p.stdout.encode()).hexdigest()}
    if p.returncode==0:row['observation']=json.loads(p.stdout)
    else:row['failure']=p.stderr
    rows.append(row)
    with OUTPUT.open('a') as f:f.write(json.dumps(row)+'\n')
    print(stem, 'exit',p.returncode, 'wall',round_ms(row),flush=True)
    if p.returncode:raise RuntimeError(stem)
def round_ms(row):return row.get('observation',{}).get('metrics',{}).get('wallMs')
# Correctness/tiny warm-up and counts are separately tagged; do not mix instrumented with normal.
for contract in ['text','snapshot']:
    for m in ['A','B4','B8','C']:run(m,contract,1000,False,'correctness-1k',0)
    for m in ['A','B4','B8','C']:run(m,contract,1000,True,'counts-1k',0)
for r,models in enumerate([['A','B4','C','B8'],['B8','C','B4','A'],['C','A','B8','B4']],1):
    for contract in (['text','snapshot'] if r%2 else ['snapshot','text']):
        for m in models:run(m,contract,10000,False,'warm-10k',r)
