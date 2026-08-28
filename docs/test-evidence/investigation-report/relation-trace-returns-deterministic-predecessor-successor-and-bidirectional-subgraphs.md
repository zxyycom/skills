### Case INVESTIGATION-RELATION-GRAPH-TRACE-001: relation trace returns deterministic predecessor successor and bidirectional subgraphs

Entry:
- `tools/investigation-report/tests/relations.test.ts > relation trace returns deterministic predecessor successor and bidirectional subgraphs`
- `bun test --test-name-pattern="^relation trace returns deterministic predecessor successor and bidirectional subgraphs$" ./tools/investigation-report/tests/run.ts`

Contract:
- 关系 trace 按方向确定性返回 predecessor、successor 或双向报告子图。

Proves:
- 从中间报告分别获得前序、后继和双向 ID 集合。
