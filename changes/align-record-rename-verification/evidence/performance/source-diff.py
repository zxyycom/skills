"""Recover exact frozen after inputs by applying this diff to exact baseline and selecting scope."""
import difflib,pathlib,json
from setup import ROOT,HERE,SCOPE
before=ROOT/'source-before';after=ROOT/'source-after';a=json.loads((ROOT/'source-before-manifest.json').read_text())['files'];b=json.loads((ROOT/'source-after-manifest.json').read_text())['files'];a={k:v for k,v in a.items() if any(k==s or k.startswith(s+'/') for s in SCOPE)};patch=[]
for rel in sorted(set(a)|set(b)):
 if a.get(rel)==b.get(rel):continue
 x=(before/rel).read_text().splitlines(True) if rel in a else [];y=(after/rel).read_text().splitlines(True) if rel in b else []
 patch.extend(difflib.unified_diff(x,y,fromfile='a/'+rel if rel in a else '/dev/null',tofile='b/'+rel if rel in b else '/dev/null'))
(HERE/'product-after.patch').write_text(''.join(patch));print('content changed existing',sum(k in a and a[k].get('sha256')!=v.get('sha256') for k,v in b.items()),'new',len(set(b)-set(a)),'representation-only',sum(k in a and a[k].get('sha256')==v.get('sha256') and a[k]!=v for k,v in b.items()))
