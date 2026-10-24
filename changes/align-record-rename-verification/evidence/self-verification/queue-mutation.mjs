import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const repository = process.cwd();
await fs.mkdir(path.join(repository,'.tmp/align-record-rename-verification-selfverify'),{recursive:true});
const directory = await fs.mkdtemp(path.join(repository, '.tmp/record-rename-queue-mutation-'));
try {
  await fs.mkdir(path.join(directory, 'tools'));
  for (const name of ['decision-records','record-operations','index-runtime','shared'])
    await fs.cp(path.join(repository,'tools',name),path.join(directory,'tools',name),{recursive:true});
  await fs.writeFile(path.join(directory,'package.json'),'{"type":"module"}');
  await fs.symlink(path.join(repository,'node_modules'),path.join(directory,'node_modules'),'dir');
  const args=['test','tools/decision-records/tests/transaction-strict-preparation.test.ts','--test-name-pattern','threshold sized'];
  const baseline=spawnSync('bun',args,{cwd:directory,encoding:'utf8',timeout:20000});
  await fs.writeFile(path.join(repository,'.tmp/align-record-rename-verification-selfverify/queue-baseline.log'),baseline.stdout+baseline.stderr);
  if (baseline.status!==0) throw new Error('isolated baseline did not pass');
  const target=path.join(directory,'tools/record-operations/src/transaction.ts');
  let source=await fs.readFile(target,'utf8');
  const start=source.indexOf('export async function verifyPlan');
  const end=source.indexOf('\nexport async function verifyWritten',start);
  source=source.slice(0,start)+`export async function verifyPlan<Value>(
  plan: RecordTransactionPlan<Value>, phase: RecordVerificationPhase
): Promise<void> {
  validateRecordTransactionWrites(plan);
  for (const change of [...plan.writes, ...(plan.index === null ? [] : [plan.index])])
    await phase.verify(change.path, change.before);
  await phase.verifyMany(plan.guards ?? []);
}
`+source.slice(end);
  await fs.writeFile(target,source);
  const mutant=spawnSync('bun',args,{cwd:directory,encoding:'utf8',timeout:20000});
  const output=mutant.stdout+mutant.stderr;
  await fs.writeFile(path.join(repository,'.tmp/align-record-rename-verification-selfverify/queue-mutant.log'),output);
  if (mutant.status===0 || !output.includes('AssertionError') || !output.includes('1003') || !output.includes('threshold sized'))
    throw new Error('mutant was not rejected by the expected queue assertion');
  console.log('isolated baseline passed; old per-write preverification mutant failed at full queue assertion');
} finally {
  await fs.rm(directory,{recursive:true});
}
