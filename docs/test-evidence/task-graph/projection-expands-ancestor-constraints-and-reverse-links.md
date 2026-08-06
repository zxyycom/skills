### Case TASK-GRAPH-INHERITANCE-001: 子任务得到完整约束来源，反向关系按 task ID 确定性返回

Entry:
- `tools/task-graph/tests/graph-projection.test.ts > projection expands ancestor constraints with declaration paths and reverse links`
- `bun test --test-name-pattern="^projection expands ancestor constraints with declaration paths and reverse links$" ./tools/task-graph/tests/run.ts`

Contract:
- 查询投影展开祖先依赖与排斥，并返回声明来源、继承路径、children 和 dependents。

Proves:
- 子任务得到完整约束来源，反向关系按 task ID 确定性返回。
