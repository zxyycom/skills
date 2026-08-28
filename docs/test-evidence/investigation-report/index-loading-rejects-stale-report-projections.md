### Case INVESTIGATION-INDEX-INTEGRITY-001: index loading rejects stale report projections

Entry:
- `tools/investigation-report/tests/index-query.test.ts > index loading rejects stale report projections`
- `bun test --test-name-pattern="^index loading rejects stale report projections$" ./tools/investigation-report/tests/run.ts`

Contract:
- 索引读取必须拒绝与权威报告 Markdown 不一致的陈旧投影。

Proves:
- 报告源变化后查询返回 source 或 index 诊断。
