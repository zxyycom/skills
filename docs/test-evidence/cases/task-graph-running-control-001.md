### Case TASK-GRAPH-RUNNING-CONTROL-001: 继承 control 的运行子任务受保护，本地覆盖使无影响的祖先编辑可提交

Tests:
- `test:f04e13a60a79eddf1e55b6f62b50e0394a348cf09e47225d0a6bbb763c8ffaf8`

Tags:
- `task-graph`

Contract:
- control 编辑必须重算后代；会改变 running task 有效 control 时拒绝。

Proves:
- 继承 control 的运行子任务受保护，本地覆盖使无影响的祖先编辑可提交。
