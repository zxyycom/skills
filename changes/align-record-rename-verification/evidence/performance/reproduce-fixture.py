"""Recreate exact measured 10k source/index bytes and original Git commit from compact templates.
Only writes a newly absent caller-chosen directory. No installation or network.
"""
import argparse,gzip,hashlib,json,pathlib,subprocess,os
HERE=pathlib.Path(__file__).resolve().parent
HEAD='9fdb438df1f4e33722cf6eb131983ba071930d75'
COMMIT='tree e442746692f7f32a6582bf15d77b520348847e0e\nauthor Record Performance Fixture <fixture@example.invalid> 1790812800 +0000\ncommitter Record Performance Fixture <fixture@example.invalid> 1790812800 +0000\n\nFreeze 1W record-operation fixture\n'
def sha(b):return hashlib.sha256(b).hexdigest()
def fingerprint(label,*fields):
 b=label.encode()+b'\0'
 for f in fields:
  f=f.encode();b+=str(len(f)).encode()+b':'+f+b'\0'
 return 'sha256:'+sha(b)
def expand(text,ident,parent,source):return text.replace('{ID}',ident).replace('{NAME}',ident.removeprefix('261001-')).replace('{PARENT}',parent).replace('{SOURCE}',source)
def reproduce(dest):
 assert not dest.exists(),'refusing overwrite';dest.mkdir(parents=True)
 data=json.loads(gzip.decompress((HERE/'fixture-recipe.json.gz').read_bytes()));indexes=data['indexes']
 for rel,f in data['files'].items():
  if 'template' not in f:continue
  p=dest/'docs'/rel;p.parent.mkdir(parents=True,exist_ok=True);ident=p.stem if p.suffix=='.md' else p.name.removeprefix('_candidate.');parent=''
  if ident.startswith('261001-record-'):
   n=int(ident.rsplit('-',1)[1]);parent=f'261001-record-{n-1000:05}' if n>1000 else ''
  b=expand(data['templates'][f['template']],ident,parent,p.name).encode();assert sha(b)==f['sha256'],rel;p.write_bytes(b);p.chmod(int(f['mode'],8))
  if 'indexTemplate'in f:
   domain=rel.split('/')[0];index=indexes[domain]['index'];e=json.loads(expand(data['entryTemplates'][f['indexTemplate']],ident,parent,rel.removeprefix(domain+'/')));index['entries'][ident]=e
   normalized=b.decode().replace('\r\n','\n');label=('decision' if domain=='decisions' else 'investigation')+'-index-entry-v2'
   index['sourceRevision']['entries'][ident]=fingerprint(label,ident,e['sourcePath'],normalized)
 for domain,spec in indexes.items():
  index=spec['index'];index['entries']=dict(sorted(index['entries'].items()));index['sourceRevision']['entries']=dict(sorted(index['sourceRevision']['entries'].items()))
  rel=domain+'/'+spec['name'];b=(json.dumps(index,ensure_ascii=False,indent=2)+'\n').encode();f=data['files'][rel];assert sha(b)==f['sha256'],rel
  p=dest/'docs'/rel;p.write_bytes(b);p.chmod(int(f['mode'],8))
 e={k:v for k,v in os.environ.items() if not k.startswith('GIT_')};e.update(GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null')
 def git(*args,input=None):return subprocess.check_output(['git','-c','core.hooksPath=/dev/null','-C',str(dest),*args],input=input,env=e).decode().strip()
 git('init','-q');git('config','core.hooksPath','/dev/null');git('config','core.autocrlf','false');git('add','docs');assert git('write-tree')=='e442746692f7f32a6582bf15d77b520348847e0e'
 assert git('hash-object','-t','commit','-w','--stdin',input=COMMIT.encode())==HEAD;git('update-ref','HEAD',HEAD)
 (dest/'.record-rename-phases-owned').write_text(str(dest.parent)+'\n');print(json.dumps({'head':HEAD,'files':len(data['files']),'hashesVerified':True}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('destination',type=pathlib.Path);a=p.parse_args();reproduce(a.destination)
