import pathlib,hashlib,subprocess,time,json
P=pathlib.Path('/workspace/skills'); O=P/'dist/record-native-survey-20261108/graphs';exe=P/'dist/record-cli-perf-261107-main/assets/investigation-report'; root=O/'resource-2000'; ID='260101-record-00000'
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def guard():
 paths=[exe,O/'guard_recheck.py',O/'resource_probe.py']+sorted((root/'docs').rglob('*'));return {str(p):h(p) for p in paths if p.is_file()}
before=guard(); rows=[]
for args in [['trace',ID,'--direction','both','--depth','all','--max-records','1'],['list','--related-to',ID,'--limit','1'],['list','--tag','nonexistent','--limit','1']]:
 for _ in range(2):
  cmd=[str(exe),*args,'--json','--root',str(root)];t=time.perf_counter();r=subprocess.run(cmd,capture_output=True,timeout=30);elapsed=1000*(time.perf_counter()-t);o=json.loads(r.stdout);assert r.returncode==0
  if args[0]=='trace':assert o['traceIds']==[ID] and o['contextIds']==[] and o['frontier']==[] and o['coverage']=={'complete':True,'stoppedBy':[]} and 'blockedEvent' not in o
  else:assert o['ok'] and o['result']['total']==0
  rows.append({'argv':cmd,'elapsed_ms':elapsed,'stdout_bytes':len(r.stdout),'stdout_sha':hashlib.sha256(r.stdout).hexdigest(),'stderr_bytes':len(r.stderr)})
after=guard();assert before==after; (O/'resource-2000-guarded.json').write_text(json.dumps({'files_guarded':len(before),'guards_before_after_equal':True,'file_hashes':before,'rows':rows},ensure_ascii=False,indent=2));print('PASS',len(before),'guarded files',[(r['argv'][1],round(r['elapsed_ms'],2)) for r in rows])
