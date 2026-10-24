"""Independent check of baseline + text patch + recorded mode restoration, no product execution."""
import hashlib,json,pathlib,shutil,subprocess,datetime
from setup import ROOT,HERE,SCOPE,env,manifest
base=json.loads((ROOT/'source-before-manifest.json').read_text())['files'];base={k:v for k,v in base.items() if any(k==s or k.startswith(s+'/') for s in SCOPE)}
after=json.loads((ROOT/'source-after-manifest.json').read_text())['files'];dest=ROOT/'source-recovered-after';assert not dest.exists();dest.mkdir()
for rel,f in base.items():
 p=dest/rel;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/'source-before'/rel,p)
for flag in ['--check',None]:
 argv=['git','-c','core.hooksPath=/dev/null','-C',str(dest),'apply']+([flag] if flag else [])+[str(HERE/'product-after.patch')]
 subprocess.run(argv,check=True,env=env(),capture_output=True)
for rel,f in after.items():(dest/rel).chmod(int(f['mode'],8))
actual=manifest(dest);assert actual==after,'recovered after mismatch'
sha=lambda b:hashlib.sha256(b).hexdigest()
proof={'verifiedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseline':'66cf190967fd9ea7a0654412c29c955801951923','fullAfterManifestEqual':True,'scopeFileCount':len(actual),'newFiles':len(set(after)-set(base)),'changedContentExistingFiles':sum(k in base and base[k]['sha256']!=v['sha256'] for k,v in after.items()),'unchangedContentRepresentationFiles':sum(k in base and base[k]['sha256']==v['sha256'] and base[k]!=v for k,v in after.items()),'modeRestoration':'archive baseline is 0644/0755; frozen workspace copy preserves current 0664/0775 file modes; mode is restored from source-after manifest, not inferred as behavior change','productPatchSHA256':sha((HERE/'product-after.patch').read_bytes()),'canonicalAfterSHA256':sha(json.dumps(actual,sort_keys=True,separators=(',',':')).encode())}
(HERE/'source-after-reconstruction.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');print(json.dumps(proof,ensure_ascii=False))
