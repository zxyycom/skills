import subprocess,os,time,json,collections,pathlib,datetime,signal
out=pathlib.Path(__file__).parent
trace=out/'hash-skills-trace.jsonl'
env=dict(os.environ,GIT_TRACE2_EVENT=str(trace))
start=time.perf_counter()
p=subprocess.Popen(['bun','run','hash:skills','--quiet'],cwd='/workspace/skills',env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
timed_out=False
try: stdout,stderr=p.communicate(timeout=120)
except subprocess.TimeoutExpired:
 timed_out=True;os.killpg(p.pid,signal.SIGTERM);stdout,stderr=p.communicate(timeout=5)
wall=(time.perf_counter()-start)*1000
(out/'hash-skills.stdout').write_bytes(stdout);(out/'hash-skills.stderr').write_bytes(stderr)
counts=collections.Counter();durations=collections.defaultdict(float);sessions={};bad=0
for line in trace.read_text().splitlines():
 e=json.loads(line)
 if e.get('event')=='start':
  args=e.get('argv',[]);cmd=next((a for a in args if a in ['rev-parse','ls-tree','cat-file','ls-files','config','hash-object','diff','status']),'other')
  counts[cmd]+=1;sessions[e['sid']]=cmd
 if e.get('event')=='exit':
  durations[sessions.get(e['sid'],'unknown')]+=e.get('t_abs',0)*1000
  bad+=e.get('code',0)!=0
result={'timestampUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':'bun run hash:skills --quiet','wallMs':wall,'exitCode':p.returncode,'timedOut':timed_out,'gitStarts':dict(counts),'gitTotalStarts':sum(counts.values()),'gitCumulativeMsMayOverlap':dict(durations),'nonzeroGitExits':bad,'traceBytes':trace.stat().st_size,'stdoutBytes':len(stdout),'stderrBytes':len(stderr)}
(out/'hash-skills-summary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
