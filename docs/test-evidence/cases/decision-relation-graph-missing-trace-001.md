### Case DECISION-RELATION-GRAPH-MISSING-TRACE-001: 共享关系图追踪不包含缺失 target

Tests:
- `test:a6206397b16df342ccb3b5d89df63ec6339df3d0a8319bf9d12166f5a5bf8ed9`

Tags:
- `decision-records`

Contract:
- 缺失 target 不是图内节点，也不能出现在 trace 内部边。

Proves:
- predecessor trace 不返回缺失 ID 或指向缺失 ID 的内部边。
