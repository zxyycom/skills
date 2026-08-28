### Case DECISION-RELATION-GRAPH-DUPLICATE-001: 共享关系图报告重复 source-target 边

Entry:

- `tools/shared/tests/relation-graph.test.ts > relation graph reports repeated source-target edges`
- `bun test --test-name-pattern="^relation graph reports repeated source-target edges$" ./tools/shared/tests/relation-graph.test.ts`

Contract:

- 同一 source-target 的第二条边必须保留第一条边定位并报告重复。

Proves:

- 重复边产生 `duplicate-edge` 及 repeatedEdge 数据。
