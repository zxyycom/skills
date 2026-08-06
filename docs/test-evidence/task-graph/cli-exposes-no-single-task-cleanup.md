### Case TASK-GRAPH-SCOPE-ONLY-001: task delete 请求以参数错误拒绝，不改变索引

Entry:
- `tools/task-graph/tests/scope-repository.test.ts > CLI exposes scope-only cleanup and no single-task deletion command`
- `bun test --test-name-pattern="^CLI exposes scope-only cleanup and no single-task deletion command$" ./tools/task-graph/tests/run.ts`

Contract:
- 第一版只允许 scope 级清理，不提供单 task delete 或 GC。

Proves:
- task delete 请求以参数错误拒绝，不改变索引。
