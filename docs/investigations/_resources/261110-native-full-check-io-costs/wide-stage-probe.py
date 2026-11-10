import os, subprocess, pathlib, json, shutil, collections, hashlib
B=pathlib.Path('/workspace/skills'); OUT=B/'dist/record-benchmarks/261110-wide-review/process'; NAT=B/'.local/record-cli/generation-jWtx84'; OLD={'decision':OUT/'old-cli/skills/decision-records/scripts/decision-records.ts','investigation':B/'dist/record-benchmarks/261110-win-check-diagnosis/old-cli/skills/investigation-report/scripts/check-investigations.ts'}
env=os.environ.copy(); env.update(GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null',GIT_TERMINAL_PROMPT='0',LC_ALL='C')
def run(args,cwd,check=True,extra=None):
 e=env.copy(); e.update(extra or {}); return subprocess.run([str(x) for x in args],cwd=cwd,env=e,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=check)
def git(p,*args): return run(['git',*args],p).stdout
summary=[]
for typ in ('decision','investigation'):
 p=OUT/('fixture-'+typ); shutil.rmtree(p,ignore_errors=True); p.mkdir(exist_ok=True); git(p,'init','-q'); git(p,'config','user.name','Fixture'); git(p,'config','user.email','fixture@example.invalid'); d=p/'records'; d.mkdir(exist_ok=True)
 binary=NAT/('decision-records' if typ=='decision' else 'investigation-report'); opt='--decisions-dir' if typ=='decision' else '--investigations-dir'; tpl=(B/'tools/record-cli/tests/fixtures/git-stage/documents'/('decision.md' if typ=='decision' else 'report-no-resources.md')).read_text(); ids=[]
 for n in range(32):
  id=f'240229-record-{n:02d}'; ids.append(id); orig='240229-record' if typ=='decision' else '240229-report'; (d/(id+'.md')).write_text(tpl.replace(orig,id))
 setup=run([binary,'--root',p,opt,'records','sync-index'],p,False)
 if setup.returncode: raise Exception((typ,setup.stderr.decode(),setup.stdout.decode()))
 (p/'unselected').write_text('baseline\n'); git(p,'add','--all'); git(p,'commit','-qm','fixture baseline'); (p/'unselected').write_text('preserve pending\n'); git(p,'add','--','unselected'); index=(p/'.git/index').read_bytes(); before=git(p,'show',':unselected'); pending_docs={id:git(p,'show',f':records/{id}.md') for id in ids}
 for id in ids: (d/(id+'.md')).write_text((d/(id+'.md')).read_text()+'\nAdditional content.\n')
 resync=run([binary,'--root',p,opt,'records','sync-index'],p,False)
 if resync.returncode: raise Exception((typ,resync.stderr.decode(),resync.stdout.decode()))
 for k in (1,8,32):
  prior_index=None
  for variant in ('native','old'):
   (p/'.git/index').write_bytes(index)
   trace=OUT/f'{typ}-{k}-{variant}.jsonl'; trace.unlink(missing_ok=True); args=([binary] if variant=='native' else ['node',OLD[typ]])+['--root',p,opt,'records','stage','--scope','all',*ids[:k]]
   result=run(args,p,False,{'GIT_TRACE2_EVENT':str(trace)})
   if result.returncode: raise Exception((typ,k,variant,result.returncode,result.stdout.decode(),result.stderr.decode()))
   assert git(p,'show',':unselected')==before
   for i,id in enumerate(ids):
    staged=git(p,'show',f':records/{id}.md'); working=(d/(id+'.md')).read_bytes()
    assert staged==(working if i<k else pending_docs[id]),(typ,k,variant,id)
   staged_index=git(p,'show',':records/'+('decision-index.json' if typ=='decision' else 'investigation-index.json')); parsed=json.loads(staged_index); assert len(parsed.get('entries',{}))==32
   if prior_index is not None: assert staged_index==prior_index, (typ,k,'staged index differs')
   prior_index=staged_index
   events=[json.loads(l) for l in trace.read_text().splitlines()]; starts=[x for x in events if x.get('event')=='start']; counts=collections.Counter(' '.join(x.get('argv',[])[3:5]) for x in starts)
   summary.append(dict(domain=typ,k=k,variant=variant,git_starts=len(starts),counts=dict(counts),status=result.returncode,selected_verified=k,unselected_verified=True,unselected_docs_equal_original_pending=32-k,index_entries=32,index_sha256=hashlib.sha256(staged_index).hexdigest(),stdout=result.stdout.decode(),stderr=result.stderr.decode()))
   print(typ,k,variant,len(starts),flush=True)
(OUT/'summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n')

# Tail-only identity: exact files read now, not proof they were unchanged during run.
def tree_digest(base):
 h=hashlib.sha256(); count=0
 for f in sorted(x for x in base.rglob('*') if x.is_file()):
  rel=f.relative_to(base).as_posix().encode(); data=f.read_bytes()
  h.update(len(rel).to_bytes(8,'big')); h.update(rel); h.update(len(data).to_bytes(8,'big')); h.update(data); count+=1
 return {'sha256':h.hexdigest(),'files':count,'root':str(base),'encoding':'sorted relative UTF-8 paths and contents, each prefixed by 8-byte big-endian length'}
identity={'description':'tail-only hashes taken after the 12 runs; no before/after stability claim', 'node_version':run(['node','--version'],B).stdout.decode().strip(), 'native':{name:hashlib.sha256((NAT/name).read_bytes()).hexdigest() for name in ('decision-records','investigation-report')}, 'old_scripts_trees':{typ:tree_digest(path.parent) for typ,path in OLD.items()}, 'dependency_note':'Node dependencies resolved from current workspace and not exhaustively fingerprinted'}
(OUT/'tail-identities.json').write_text(json.dumps(identity,indent=2,ensure_ascii=False)+'\n')
