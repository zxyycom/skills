"""仅操作本轮受控目录；产品命令的执行不在本文件内。"""
import argparse,datetime,hashlib,json,os,pathlib,shutil,subprocess,tarfile
BASE='1adb98465a7972de3517bf5128a504504419affc'
FIXTURE_HEAD='9fdb438df1f4e33722cf6eb131983ba071930d75'
ROOT=pathlib.Path('/tmp/record-end-to-end-1adb9846-20261024')
REPO=pathlib.Path('/workspace/skills')
HERE=pathlib.Path(__file__).resolve().parent
OLD=pathlib.Path('/tmp/unify-record-operations-baseline/fixture-v3')
PARTS=['tools','scripts','skills','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json']
def env():
 e={k:v for k,v in os.environ.items() if not k.startswith('GIT_') and k not in ['NODE_OPTIONS','NODE_PATH']}
 e.update(GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null',GIT_TERMINAL_PROMPT='0',TZ='UTC')
 return e
def git(root,*args):return subprocess.check_output(['git','-c','core.hooksPath=/dev/null','-C',str(root),*args],env=env()).decode().strip()
def manifest(root,exclude=()):
 out={}
 for p in sorted(root.rglob('*')):
  if any(p==root/x or (root/x) in p.parents for x in exclude):continue
  s=p.lstat();rel=str(p.relative_to(root))
  if p.is_symlink():out[rel]={'kind':'symlink','target':os.readlink(p),'mode':oct(s.st_mode&0o7777)}
  elif p.is_file():
   b=p.read_bytes();out[rel]={'kind':'file','sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'mode':oct(s.st_mode&0o7777)}
 return out
def save(name,value):
 p=ROOT/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n')
def setup_root():
 ROOT.mkdir(exist_ok=True)
 note=ROOT/'artifact-note.md'
 if not note.exists():note.write_text(f'''# file-lifecycle-hygiene：record-end-to-end-1adb9846-20261024

对象：本目录 source-before/、source-after/、dependencies/、fixture/、raw/、*.json。
来源：before精确Git {BASE}；after待稳定工作树闭包；fixture从只读旧HEAD {FIXTURE_HEAD} 独立clone，依赖从宿主已装目录复制，不安装。
用途：本轮实际CLI有限before/after与独立后验，不是长期benchmark。
形成时间：{datetime.datetime.now(datetime.timezone.utc).isoformat()}
状态与保留原因：准备中；保留源码/依赖字节与raw输出用于复核。
后续处理：Change结项后可删除此精确私有目录；不清理其他/tmp，不reset旧fixture或真实仓库。
''')
def baseline():
 dest=ROOT/'source-before'
 if dest.exists():raise SystemExit('拒绝覆盖已冻结before')
 dest.mkdir();archive=ROOT/'source-before.tar'
 subprocess.run(['git','archive','--format=tar','-o',str(archive),BASE,*PARTS],cwd=REPO,check=True,env=env())
 with tarfile.open(archive) as t:t.extractall(dest,filter='data')
 m=manifest(dest);save('source-before-manifest.json',{'head':BASE,'files':m,'canonicalSHA256':hashlib.sha256(json.dumps(m,sort_keys=True,separators=(',',':')).encode()).hexdigest()})
def deps():
 dest=ROOT/'dependencies/node_modules'
 if dest.exists():raise SystemExit('拒绝覆盖已冻结依赖')
 source=REPO/'node_modules';before=manifest(source)
 shutil.copytree(source,dest,symlinks=True)
 copied=manifest(dest);after=manifest(source)
 if before!=copied or before!=after:raise RuntimeError('依赖copy中发生漂移，保留现场且不计时')
 for rel,f in copied.items():
  if f['kind']=='symlink' and not (dest/rel).resolve().is_relative_to(dest.resolve()):raise RuntimeError('依赖symlink越出冻结边界 '+rel)
 save('dependencies-manifest.json',{'source':str(source),'files':copied,'canonicalSHA256':hashlib.sha256(json.dumps(copied,sort_keys=True,separators=(',',':')).encode()).hexdigest()})
 for name in ['source-before','source-after']:
  if (ROOT/name).exists():(ROOT/name/'node_modules').symlink_to(dest,target_is_directory=True)
def fixture():
 dest=ROOT/'fixture'
 if dest.exists():raise SystemExit('拒绝覆盖已有fixture')
 assert git(OLD,'rev-parse',FIXTURE_HEAD)==FIXTURE_HEAD
 subprocess.run(['git','-c','core.hooksPath=/dev/null','clone','--no-hardlinks','--no-checkout',str(OLD),str(dest)],check=True,env=env(),capture_output=True)
 git(dest,'remote','remove','origin');git(dest,'config','core.hooksPath','/dev/null');git(dest,'config','core.autocrlf','false');git(dest,'checkout','--detach',FIXTURE_HEAD)
 frozen=json.loads((OLD/'tree-manifest.json').read_text())
 actual=manifest(dest/'docs')
 expected={k.removeprefix('docs/'):v for k,v in frozen.items()}
 assert actual.keys()==expected.keys()
 for rel,f in expected.items():
  p=dest/'docs'/rel
  assert actual[rel]['sha256']==f['sha256'] and actual[rel]['bytes']==f['bytes']
  p.chmod(int(f['mode'],8))
 actual=manifest(dest/'docs')
 for rel,f in expected.items():assert all(actual[rel][k]==f[k] for k in ['sha256','bytes','mode'])
 assert git(dest,'rev-parse','HEAD')==FIXTURE_HEAD and not git(dest,'remote')
 save('fixture-manifest.json',{'head':FIXTURE_HEAD,'oldManifestSHA256':hashlib.sha256((OLD/'tree-manifest.json').read_bytes()).hexdigest(),'files':actual,'canonicalSHA256':hashlib.sha256(json.dumps(actual,sort_keys=True,separators=(',',':')).encode()).hexdigest()})
 (dest/'.record-end-to-end-owned').write_text(str(ROOT)+'\n')
def after():
 dest=ROOT/'source-after'
 if dest.exists():raise SystemExit('拒绝覆盖已冻结after；新冻结须另取名并保留旧样本')
 names=git(REPO,'ls-files','--cached','--others','--exclude-standard','--',*PARTS).splitlines();names=sorted(set(names))
 def selected():return {rel:manifest_file(REPO/rel) for rel in names if (REPO/rel).is_file() or (REPO/rel).is_symlink()}
 before=selected();dest.mkdir()
 for rel in before:
  p=dest/rel;p.parent.mkdir(parents=True,exist_ok=True);q=REPO/rel
  if q.is_symlink():p.symlink_to(os.readlink(q))
  else:shutil.copy2(q,p)
 copied=manifest(dest);end=selected()
 assert before==copied==end,'after复制过程中source漂移'
 for file in ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml']:
  assert (dest/file).read_bytes()==(ROOT/'source-before'/file).read_bytes(),'依赖配置变化，请另行冻结兼容依赖'
 (dest/'node_modules').symlink_to(ROOT/'dependencies/node_modules',target_is_directory=True)
 save('source-after-manifest.json',{'sourceHead':git(REPO,'rev-parse','HEAD'),'files':copied,'canonicalSHA256':hashlib.sha256(json.dumps(copied,sort_keys=True,separators=(',',':')).encode()).hexdigest()})
def manifest_file(p):
 s=p.lstat()
 return {'kind':'symlink','target':os.readlink(p),'mode':oct(s.st_mode&0o7777)} if p.is_symlink() else {'kind':'file','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'mode':oct(s.st_mode&0o7777)}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('action',choices=['baseline','dependencies','fixture','after']);a=p.parse_args();setup_root();{'baseline':baseline,'dependencies':deps,'fixture':fixture,'after':after}[a.action]();print(a.action,'prepared')
