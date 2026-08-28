### Case INVESTIGATION-SNAPSHOT-DUPLICATE-STATE-001: index state projects strict empty metadata and no sourcePath

Entry:
- `tools/investigation-report/tests/index-query.test.ts > index state projects strict empty metadata and no sourcePath`
- `bun test --test-name-pattern="^index state projects strict empty metadata and no sourcePath$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告索引 metadata 必须严格为空，entry state 不重复保存可由 ID 推导的 sourcePath。

Proves:
- 持久化索引的 metadata 为 `{}`，报告 state 不含 sourcePath。
