#!/usr/bin/env python3
import json,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).with_name('interleaved-results.jsonl')
rows=[json.loads(s) for s in p.read_text().splitlines()]; head=rows[0]; foot=rows[-1]; samples=[r for r in rows if r['type']=='sample']; assert head['preflight_ok'] and foot['no_drift'] and foot['error'] is None and len(samples)==168 and all(s['matches_frozen'] for s in samples)
result={'source':p.name,'header_utc':head['utc'],'footer_utc':foot['utc'],'n_warmups':sum(s['warmup'] for s in samples),'n_samples':sum(not s['warmup'] for s in samples),'no_drift':foot['no_drift'],'all_match':True,'cells':{}}
for case in ('page','metadata-zero'):
 for kind in ('rust','node'):
  med=[]
  for n in (100,1000,10000):
   seq=[s['elapsed_ms'] for s in samples if s['case']==case and s['n']==n and s['kind']==kind and not s['warmup']]; assert len(seq)==12
   med.append(statistics.median(seq));result['cells'][f'{case}/{kind}/{n}']={'median_ms':statistics.median(seq),'min_ms':min(seq),'max_ms':max(seq),'first6_median_ms':statistics.median(seq[:6]),'last6_median_ms':statistics.median(seq[6:]),'ms_per_1000_records':statistics.median(seq)*1000/n}
  result['cells'][f'{case}/{kind}/growth']={'100_to_1000':med[1]/med[0],'1000_to_10000':med[2]/med[1]}
print(json.dumps(result,ensure_ascii=False,indent=2))
