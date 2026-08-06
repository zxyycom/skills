### Case TASK-GRAPH-RUNNING-CONTROL-001: 继承 control 的运行子任务受保护，本地覆盖使无影响的祖先编辑可提交

Entry:
- `tools/task-graph/tests/lifecycle.test.ts > ancestor control changes cannot alter a running descendant effective control`
- `bun test --test-name-pattern="^ancestor control changes cannot alter a running descendant effective control$" ./tools/task-graph/tests/run.ts`

Contract:
- control 编辑必须重算后代；会改变 running task 有效 control 时拒绝。

Proves:
- 继承 control 的运行子任务受保护，本地覆盖使无影响的祖先编辑可提交。
