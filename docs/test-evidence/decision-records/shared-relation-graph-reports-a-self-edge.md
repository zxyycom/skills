### Case DECISION-RELATION-GRAPH-SELF-001: 共享关系图报告自环

Entry:

- `tools/shared/tests/relation-graph.test.ts > relation graph reports a self edge`
- `bun test --test-name-pattern="^relation graph reports a self edge$" ./tools/shared/tests/relation-graph.test.ts`

Contract:

- 共享图结构校验必须返回可定位的自环 edge。

Proves:

- 自环产生 `self-edge` 结构问题。
