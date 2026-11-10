"""Run after the wall-time matrix; instrumentation is not a wall-time sample."""
import collections, importlib.util, json, os, pathlib
base=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('measure',base/'measure.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
inv=json.loads((base/'fixture-inventory.json').read_text());result={}
for case in m.SPECS:
 trace=base/f'{case}-old-trace.jsonl'
 env=dict(m.ENV,GIT_TRACE2_EVENT=str(trace))
 r=m.run(['node','--import',base/'old-profile.mjs',m.OLD,'--root',base/'fixtures'/case,'check'],env=env)
 assert m.sha(r.stdout)==inv[case]['old_output']
 lines=r.stderr.decode().splitlines();assert len(lines)==1 and lines[0].startswith('OLD_DIRECTORY_PROBE '),lines[:2]
 counters=json.loads(lines[0][len('OLD_DIRECTORY_PROBE '):]);git=collections.Counter()
 for line in trace.read_text().splitlines():
  v=json.loads(line)
  if v.get('event')=='start':
   args=v['argv'];git[args[3] if len(args)>2 and args[1]=='-C' else args[1]]+=1
 result[case]={'directory_counts':counters,'git_counts':dict(git)}
 assert m.tree(base/'fixtures'/case)==inv[case]['tree']
m.write_json('old-diagnostics.json',result)
for case,r in result.items():
 dirs=r['directory_counts'];print(case,'git',r['git_counts'],'readdir',sum(x['calls'] for x in dirs.values()),'entries',sum(x['entries'] for x in dirs.values()))
