### Case INVESTIGATION-SYNC-VALIDATED-SNAPSHOT-001: full synchronization rejects an empty report collection

Entry:

- `tools/investigation-report/tests/index-query.test.ts > full synchronization rejects an empty report collection`
- `bun test --test-name-pattern="^full synchronization rejects an empty report collection$" ./tools/investigation-report/tests/run.ts`

Contract:

- 公共完整 index 同步要求集合至少有一份报告，拒绝时不写派生 index。

Proves:

- 空集合调用 `synchronizeInvestigationIndex` 返回集合诊断，且目标 index 不存在。
