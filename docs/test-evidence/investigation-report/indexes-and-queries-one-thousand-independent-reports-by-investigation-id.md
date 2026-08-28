### Case INVESTIGATION-SCALE-INDEX-001: indexes and queries one thousand independent reports by Investigation ID

Entry:
- `tools/investigation-report/tests/scale.test.ts > indexes and queries one thousand independent reports by Investigation ID`
- `bun test --test-name-pattern="^indexes and queries one thousand independent reports by Investigation ID$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告索引与查询可处理一千份独立 Investigation ID 报告并保持 ID 排序。

Proves:
- 查询返回 1,000 条结果及首尾确定性 ID。
