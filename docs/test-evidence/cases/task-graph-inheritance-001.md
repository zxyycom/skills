### Case TASK-GRAPH-INHERITANCE-001: 子任务得到完整约束来源，反向关系按 task ID 确定性返回

Tests:
- `test:f5e267863198f36d383a19a0016edfd69beaeddf79556fe96cbcdd8fe602f386`

Tags:
- `task-graph`

Contract:
- 查询投影展开祖先依赖与排斥，并返回声明来源、继承路径、children 和 dependents。

Proves:
- 子任务得到完整约束来源，反向关系按 task ID 确定性返回。
