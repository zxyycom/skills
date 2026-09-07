### Case TASK-GRAPH-REMOVE-BLOCKERS-001: task removal 报告终态和关系边界 blocker

Tests:
- `test:454f9f5006a3b2df4f26a5b6c493be99d2f0bb3aed99628cc77033571273c44d`

Tags:
- `task-graph`

Contract:
- 只有已成功或取消、且父子、依赖和排斥关系不跨越选择边界的显式 task 集合可以删除。

Proves:
- 非终态、父节点留存、子节点留存、依赖跨界和排斥跨界分别产生结构化 blocker；任一失败都不修改原索引。
