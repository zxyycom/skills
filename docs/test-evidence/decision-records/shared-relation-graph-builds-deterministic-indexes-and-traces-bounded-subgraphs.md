### Case DECISION-RELATION-GRAPH-TRACE-001: 共享关系图构建确定性索引并执行有界追踪

Entry:
- `tools/shared/tests/relation-graph.test.ts > relation graph builds deterministic indexes and traces bounded subgraphs`
- `bun test --test-name-pattern="^relation graph builds deterministic indexes and traces bounded subgraphs$" ./tools/shared/tests/relation-graph.test.ts`

Contract:
- Decision Records 关系演进共享的图原语必须从已知 ID 与有向边构建确定性正反向索引，并按方向和最大深度返回内部子图。

Proves:
- 边、按 source 索引和按 target 索引都按 locale 无关的 UTF-16 代码单元顺序排列。
- 双向 trace 在深度一包含直接前序与后继，在深度零只保留起点。
