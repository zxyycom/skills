### Case TASK-GRAPH-REMOVE-BLOCKERS-001: task removal 报告终态和关系边界 blocker

Tests:
- `test:951d3e9a85664b954d6dc7b8e78c4d796a7c7b13080020ebf5d3afa29e5cde4b`

Tags:
- `task-graph`

Contract:
- 只有已成功或取消、且父子、依赖和排斥关系不跨越选择边界的显式 task 集合可以删除。

Proves:
- 非终态、父节点留存、子节点留存、依赖跨界和排斥跨界分别产生结构化 blocker；任一失败都不修改原索引。
