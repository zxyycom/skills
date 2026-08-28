### Case DECISION-RELATION-GRAPH-INDEX-001: 共享关系图按输入边顺序构建 source 与 target 索引

Entry:

- `tools/shared/tests/relation-graph.test.ts > relation graph builds source and target indexes in supplied edge order`
- `bun test --test-name-pattern="^relation graph builds source and target indexes in supplied edge order$" ./tools/shared/tests/relation-graph.test.ts`

Contract:

- 建图只建立全局边、source 索引和 target 索引，不隐式改变调用方提供的边顺序。

Proves:

- 三类边集合均保留各自在输入中可观察到的相对顺序。
