### Case INVESTIGATION-CLI-STAGE-PENDING-001: CLI stage-index preserves pending transaction facts

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI stage-index preserves pending transaction facts`
- `bun test --test-name-pattern="^CLI stage-index preserves pending transaction facts$" ./tools/investigation-report/tests/run.ts`

Contract:
- `stage-index` 的 pending index 失败必须把 runtime 的 cause、scope 和 outcome 作为领域诊断输出。

Proves:
- Git pending index lock 返回退出码 1、stdout 为空，stderr 保留 pending-conflict、busy cause、scope 与 no-change outcome。
