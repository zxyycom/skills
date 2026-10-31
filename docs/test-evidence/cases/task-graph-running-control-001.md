### Case TASK-GRAPH-RUNNING-CONTROL-001: 继承 control 的运行子任务受保护，本地覆盖使无影响的祖先编辑可提交

Tests:
- `test:a9db3f9ee2d26db9a7446f745e02388a608b5a5f0972c4c934fa71f9631f27aa`

Tags:
- `task-graph`

Contract:
- control 编辑必须重算后代；会改变 running task 有效 control 时拒绝。

Proves:
- 继承 control 的运行子任务受保护，本地覆盖使无影响的祖先编辑可提交。
