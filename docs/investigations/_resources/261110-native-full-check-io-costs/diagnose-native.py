"""Handle the valid no-Git-call case without requiring a Trace2 file."""
import collections, importlib.util, json, pathlib
base=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('measure',base/'measure.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
inv=json.loads((base/'fixture-inventory.json').read_text());outputs={}
for case in m.SPECS:
 root=base/'fixtures'/case;trace=base/f'{case}-native-trace-final.jsonl'
 r=m.run([m.NATIVE,'--root',root,'check','--json'],env=dict(m.ENV,GIT_TRACE2_EVENT=str(trace)))
 assert m.sha(r.stdout)==inv[case]['native_output']
 counts=collections.Counter()
 for line in trace.read_text().splitlines() if trace.exists() else []:
  v=json.loads(line)
  if v.get('event')=='start':counts[v['argv'][3]]+=1
 r=m.run([m.PROBE,'--root',root,'check','--json'])
 assert m.sha(r.stdout)==inv[case]['native_output']
 metrics=json.loads(next(l for l in r.stderr.decode().splitlines() if l.startswith('RECORD_PROBE '))[len('RECORD_PROBE '):])
 outputs[case]={'git_counts':dict(counts),'metrics':metrics}
 assert m.tree(root)==inv[case]['tree']
m.write_json('diagnostics.json',outputs)
for case,row in outputs.items():
 print(case,'git',sum(row['git_counts'].values()),row['git_counts'])
 print('phases',{k:round(v['nanos']/1e6,2) for k,v in row['metrics'].items() if k.startswith('phase:')})
 print('enumerations',sum(v['calls'] for k,v in row['metrics'].items() if k.startswith('enumerate:')),'entries',sum(v['entries'] for k,v in row['metrics'].items() if k.startswith('enumerate:')))
