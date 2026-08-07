### Case TASK-GRAPH-RUNTIME-ENGINE-001: Node engine 在安装状态前失败关闭

Entry:
- `tools/task-graph/tests/runtime.test.ts > runtime engine boundaries reject unsupported Node before installation state`
- `bun test --test-name-pattern="^runtime engine boundaries reject unsupported Node before installation state$" ./tools/task-graph/tests/run.ts`

Contract:
- Mutation runtime 只支持 `^22.22.2 || ^24.15.0 || >=26.0.0`。

Proves:
- 边界下版本与 Node 25 返回 `RUNTIME_UNSUPPORTED`，三个最低受支持版本继续得到准确的 missing 状态。
