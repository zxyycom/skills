### Case TASK-GRAPH-RUNTIME-ENGINE-001: Node engine 在安装状态前失败关闭

Entry:
- `tools/task-graph/tests/runtime.test.ts > runtime inspection rejects unsupported Node before installation state`
- `bun test --test-name-pattern="^runtime inspection rejects unsupported Node before installation state$" ./tools/task-graph/tests/run.ts`

Contract:
- Mutation runtime 只支持 `^22.22.2 || ^24.15.0 || >=26.0.0`。

Proves:
- 不受支持的 Node 在 info 和 mutation binding 加载中都先返回 `RUNTIME_UNSUPPORTED`，不会把缺失目录误报为安装问题。
