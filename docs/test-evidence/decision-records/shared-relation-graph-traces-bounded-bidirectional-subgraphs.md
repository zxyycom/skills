### Case DECISION-RELATION-GRAPH-TRACE-001: 共享关系图执行有界双向追踪

Entry:

- `tools/shared/tests/relation-graph.test.ts > relation graph traces bounded bidirectional subgraphs`
- `bun test --test-name-pattern="^relation graph traces bounded bidirectional subgraphs$" ./tools/shared/tests/relation-graph.test.ts`

Contract:

- 共享关系图按方向和最大深度返回确定的内部子图。

Proves:

- 深度一的双向追踪包含直接前序和后继；深度零仅保留起点。
