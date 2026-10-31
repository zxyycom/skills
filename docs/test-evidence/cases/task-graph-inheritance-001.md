### Case TASK-GRAPH-INHERITANCE-001: 子任务得到完整约束来源，反向关系按 task ID 确定性返回

Tests:
- `test:1c13e6569bc2a16f04dfe5165f853f7f3ac1b1fef19951a6a17299401779c563`

Tags:
- `task-graph`

Contract:
- 查询投影展开祖先依赖与排斥，并返回声明来源、继承路径、children 和 dependents。

Proves:
- 子任务得到完整约束来源，反向关系按 task ID 确定性返回。
