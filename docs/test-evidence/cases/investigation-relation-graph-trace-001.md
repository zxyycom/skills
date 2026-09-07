### Case INVESTIGATION-RELATION-GRAPH-TRACE-001: relation trace returns deterministic predecessor successor and bidirectional subgraphs

Tests:
- `test:f2d6fc76cfd2bb6e106f980bdd7f424ae14f3fa792c127a0f75223ee3bd5f1da`

Tags:
- `investigation-report`

Contract:
- Investigation 关系 trace 从报告 state 出发，按方向返回 predecessor、successor 或双向子图；`maxDepth` 限制可达节点深度。

Proves:
- 从中间报告分别获得前序、后继和双向 ID 集合。
- 双向 trace 返回预期顺序的关系边，并透传存在的可选 summary。
- `maxDepth: 0` 时只返回起始报告 ID。
