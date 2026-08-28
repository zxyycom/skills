### Case INVESTIGATION-SYNC-VALIDATED-SNAPSHOT-001: full synchronization rejects an empty report collection

Entry:
- `tools/investigation-report/tests/index-query.test.ts > full synchronization rejects an empty report collection`
- `bun test --test-name-pattern="^full synchronization rejects an empty report collection$" ./tools/investigation-report/tests/run.ts`

Contract:
- 完整索引同步和查询要求集合中至少存在一份报告。

Proves:
- 空集合查询返回错误。
