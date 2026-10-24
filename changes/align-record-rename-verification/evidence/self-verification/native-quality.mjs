import {defineConfig, run} from '@zxyycom/vibe-check';
import {createVibeNativeChecks} from '../../../../scripts/lib/vibe-gate/checks/native.ts';
const ids = ['duplicate-detection', 'file-metrics', 'function-metrics'];
const result = await run(defineConfig({
  checks: createVibeNativeChecks().filter(check => ids.includes(check.checkId)),
  scheduler: {maxParallel: 1,resourceCapacities: {"external-process":3,"repository-scan":2}},
  outputs: {machinePublication: {enabled: false}}
}));
if (result.kind !== 'completed') throw new Error('Native quality run did not complete: ' + JSON.stringify(result));
for (const check of result.snapshot.checks) {
  console.log(JSON.stringify({checkId:check.checkId,outcome:check.outcome,data:check.data}));
}
if (result.snapshot.checks.some(check => check.outcome.status !== 'passed')) process.exitCode = 1;
