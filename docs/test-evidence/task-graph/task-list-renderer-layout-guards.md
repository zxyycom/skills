### Case TASK-GRAPH-LIST-LAYOUT-GUARDS-001: Renderer 在无效 projection 关系到达 layout 时失败关闭

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list renderer fails closed when invalid projection relations reach layout`
- `bun test --test-name-pattern="^task-list renderer fails closed when invalid projection relations reach layout$" ./tools/task-graph/tests/run.ts`

Contract:
- `TaskGraphService.listTasks()` 负责产生合法全量 projection；若缺失 endpoint、关系环或 self-exclusion 仍到达内部 layout，实际使用点必须失败关闭而不是生成部分文本。

Proves:
- 同一矩阵覆盖缺失 parent、dependency、exclusion endpoint，以及 parent cycle、dependency cycle 和 self-exclusion。
- 每个场景都抛出能够定位相应 endpoint 或关系类别的错误。
