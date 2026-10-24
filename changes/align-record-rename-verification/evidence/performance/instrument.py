"""Frozen copies only: exact anchors, function-boundary assertions, no hot I/O trace."""
import difflib,json,pathlib,re,shutil,subprocess
from setup import ROOT,HERE,manifest,save
TARGETS={
 'record-operations/src/transaction.ts': [('runRecordTransaction','shared.transaction'),('verifyPlan','shared.preverify'),('verifyWritten','shared.postverify')],
 'decision-records/src/decision-rename.ts':[('prepareDecisionRenameAtCurrentState','domain.rename.prepare')],
 'decision-records/src/scan-snapshot.ts':[('loadDecisionTransactionValidationContext','domain.initial_validation')],
 'decision-records/src/cli-lifecycle-commands.ts':[('loadLifecycleScan','domain.discard.initial_validation')],
 'investigation-report/src/rename-preparation.ts':[('prepareRename','domain.rename.prepare')],
 'investigation-report/src/rename-verification.ts':[('verifyPreparedRename','domain.rename.fresh_sources'),('verifyCommittedRename','domain.rename.postverify')],
 'investigation-report/src/discard-loading.ts':[('discardFromCollection','domain.discard.pipeline.inclusive'),('discardFreshnessFailure','domain.discard.early_fresh'),('commitLoadedDiscard','domain.discard.commit_container.inclusive')],
}
def wrap_function(s,name,label):
 pat=r'(?:export )?async function '+re.escape(name)+r'(?:<[^>]+>)?\('
 hits=list(re.finditer(pat,s));assert len(hits)==1,(name,len(hits))
 start=hits[0].start();ret=s.index('): Promise<',start);cursor=s.index('<',ret)+1;depth=1
 while depth:
  if s[cursor]=='<':depth+=1
  elif s[cursor]=='>':depth-=1
  cursor+=1
 op=s.index('{',cursor);cl=s.index('\n}',op)+1
 assert s[op]=='{' and s[cl]=='}'
 body=s[op+1:cl]
 assert not re.search(r'\n(?:export )?(?:async )?function ',body),(name,'crossed function')
 injection='\nconst __rpToken = globalThis.__rpBegin('+json.dumps(label)+'); try {'
 return s[:op+1]+injection+body+'\n} finally { globalThis.__rpEnd(__rpToken); }\n'+s[cl:],{'function':name,'label':label,'originalStartLine':s.count('\n',0,start)+1,'originalBodyStartLine':s.count('\n',0,op)+1,'originalEndLine':s.count('\n',0,cl)+1}
def block(statement,label,extra='undefined'):
 return '{ const __rpToken = globalThis.__rpBegin('+json.dumps(label)+', '+extra+'); try { '+statement+' } finally { globalThis.__rpEnd(__rpToken); } }'
def instrument(version):
 source=ROOT/('source-'+version);dest=ROOT/('instrumented-'+version);assert not dest.exists();shutil.copytree(source,dest,symlinks=True)
 patches=[];mapping=[]
 for domain in ['decision-records','investigation-report']:
  prefix=pathlib.Path('skills')/domain/'scripts/runtime/tools'
  for rel,functions in TARGETS.items():
   p=dest/prefix/rel
   if not p.exists():continue
   old=p.read_text();s=old
   # Reverse function order ensures recorded original line offsets are unaffected by earlier wrappers.
   ordered=sorted(functions,key=lambda x:s.index('function '+x[0]),reverse=True)
   for name,label in ordered:
    s,loc=wrap_function(s,name,label);mapping.append({'file':str(prefix/rel),**loc})
   if rel=='record-operations/src/transaction.ts':
    fresh_call = 'await options.fresh(plan.value, phase);' if 'await options.fresh(plan.value, phase);' in s else 'await options.fresh(plan.value);'
    for needle,label in [('await options.prepare();','shared.prepare'),(fresh_call,'domain.fresh'),('await options.verify(plan.value);','domain.postverify'),('await options.cleanup(plan.value, writes);','cleanup'),('await options.resources.apply(plan.value);','resources.apply')]:
     if needle=='await options.prepare();':
      # Preserve binding and async order using the existing prepare function callback, not body surgery.
      continue
     assert s.count(needle) in [1,2],(needle,s.count(needle));s=s.replace(needle,block(needle,label))
    needle='if (plan.index !== null) await journal.apply(plan.index, true);'
    assert s.count(needle)==1;s=s.replace(needle,'if (plan.index !== null) '+block('await journal.apply(plan.index, true);','publish'))
    needle='for (const [index, change] of plan.writes.entries())\n      await journal.apply(\n        change,\n        plan.index === null && index === plan.writes.length - 1\n      );'
    assert s.count(needle)==1;s=s.replace(needle,block(needle,'write.loop','{plannedWrites:plan.writes.length, guards:(plan.guards ?? []).length, index:plan.index !== null, unchanged:plan.writes.filter(change => change.before !== null && change.next !== null && Buffer.from(change.next).equals(Buffer.from(change.before.bytes))).length}'))
    # prepare inside runRecordTransaction; outer domain preparation occurs separately and is not included.
    needle='const plan = await options.prepare();';assert s.count(needle)==1
    # Preflight is not measured; preserve this branch verbatim.
    needle='plan = await options.prepare();';assert s.count(needle)==2
    s=s.replace('\n      '+needle,'\n      '+block(needle,'shared.prepare'),1)
   p.write_text(s);patches.extend(difflib.unified_diff(old.splitlines(True),s.splitlines(True),fromfile='a/'+str(prefix/rel),tofile='b/'+str(prefix/rel)))
   subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs'; import {stripTypeScriptTypes} from 'node:module'; stripTypeScriptTypes(fs.readFileSync(process.argv[1],'utf8'));",str(p)],check=True,capture_output=True)
 (HERE/('instrumentation-'+version+'.patch')).write_text(''.join(patches))
 save('instrumented-'+version+'-manifest.json',{'files':manifest(dest,exclude=('node_modules',)),'mapping':mapping})
 (HERE/('instrumentation-'+version+'-mapping.json')).write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
 return dest
if __name__=='__main__':
 import sys
 instrument(sys.argv[1])
