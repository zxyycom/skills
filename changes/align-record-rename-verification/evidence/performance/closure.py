import gzip,json,hashlib,subprocess,sys
from setup import ROOT,HERE,SCOPE,env
v=sys.argv[1];source=ROOT/('source-'+v);proof=json.loads((ROOT/('source-'+v+'-manifest.json')).read_text());subset={k:f for k,f in proof['files'].items() if any(k==x or k.startswith(x+'/') for x in SCOPE)}
value={'scope':SCOPE,'files':subset,'canonicalSHA256':hashlib.sha256(json.dumps(subset,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'originalBroaderArchive':v=='before'}
(HERE/'manifests'/('scope-'+v+'.json.gz')).write_bytes(gzip.compress(json.dumps(value,sort_keys=True,ensure_ascii=False,indent=2).encode(),mtime=0))
p=subprocess.run(['node',str(HERE/'import-audit.mjs'),str(source),str(ROOT/'dependencies/node_modules'),str(HERE/('import-closure-'+v+'.json'))],env=env(),capture_output=True,text=True)
(HERE/('import-closure-'+v+'.stderr')).write_text(p.stderr);assert p.returncode==0,p.stderr
print(json.dumps({'version':v,'scopeFiles':len(subset),'scopeSHA256':value['canonicalSHA256'],'importOnlyAuditPassed':True}))
