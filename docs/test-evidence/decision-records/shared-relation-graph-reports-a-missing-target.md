### Case DECISION-RELATION-GRAPH-STRUCTURE-001: 共享关系图报告缺失 target

Entry:

- `tools/shared/tests/relation-graph.test.ts > relation graph reports a missing target`
- `bun test --test-name-pattern="^relation graph reports a missing target$" ./tools/shared/tests/relation-graph.test.ts`

Contract:

- 共享图结构校验以结构化数据报告缺失 target。

Proves:

- 缺失边保留其可定位的 source、target 和 type 数据。
