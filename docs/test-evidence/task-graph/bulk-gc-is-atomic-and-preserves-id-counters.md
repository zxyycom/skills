### Case TASK-GRAPH-GC-001: 包含不可关闭 scope 时无变更

Entry:
- `tools/task-graph/tests/scope-repository.test.ts > bulk scope GC validates all selections before one revision and preserves nextIds`
- `bun test --test-name-pattern="^bulk scope GC validates all selections before one revision and preserves nextIds$" ./tools/task-graph/tests/run.ts`

Contract:
- 显式非空多 scope GC 先验证全部选择，再一次 revision 原子删除并保留 nextIds。

Proves:
- 包含不可关闭 scope 时无变更；合法批次排序返回、只增一次 revision 且不复用 ID。
