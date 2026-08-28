### Case INVESTIGATION-STAGE-MISSING-001: stage-index rejects IDs missing from the current collection

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index rejects IDs missing from the current collection`
- `bun test --test-name-pattern="^stage-index rejects IDs missing from the current collection$" ./tools/investigation-report/tests/run.ts`

Contract:
- 当前报告集合不存在的 Investigation ID 不能被选择性暂存。

Proves:
- 缺失 ID 返回错误。
