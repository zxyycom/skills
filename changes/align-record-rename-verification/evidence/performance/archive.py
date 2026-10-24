"""Build self-excluding evidence inventory after collectors/summaries are final."""
import hashlib,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
out={}
for p in sorted(HERE.rglob('*')):
 if p.is_file() and p.name!='archive-inventory.json' and '__pycache__' not in p.parts:out[str(p.relative_to(HERE))]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(HERE/'archive-inventory.json').write_text(json.dumps({'files':out,'selfExcluded':'archive-inventory.json'},ensure_ascii=False,sort_keys=True,indent=2)+'\n')
print('archived evidence files',len(out))
