### Case DECISION-CANDIDATE-INDEX-CONTEXT-001: 已建立记录要求当前有效索引

Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > candidate collection requires a current valid index when established records exist`
- `bun test --test-name-pattern="^candidate collection requires a current valid index when established records exist$" ./tools/decision-records/tests/run.ts`

Contract:
- 已存在 established records 时，candidates collection 必须拒绝缺失、无效或来源漂移的 index。

Proves:
- 三种 index 状态均失败且不输出候选结果。
