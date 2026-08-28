### Case DECISION-RELATION-GRAPH-INDEX-001: 共享关系图构建确定性 source 与 target 索引

Entry:

- `tools/shared/tests/relation-graph.test.ts > relation graph builds deterministic source and target indexes`
- `bun test --test-name-pattern="^relation graph builds deterministic source and target indexes$" ./tools/shared/tests/relation-graph.test.ts`

Contract:

- 共享关系图必须以确定顺序投影全局边、source 索引和 target 索引。

Proves:

- 三类边集合均按确定性顺序返回。
