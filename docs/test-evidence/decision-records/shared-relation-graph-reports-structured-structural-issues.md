### Case DECISION-RELATION-GRAPH-STRUCTURE-001: 共享关系图返回可定位的结构问题

Entry:
- `tools/shared/tests/relation-graph.test.ts > relation graph returns structured missing self duplicate and cycle issues`
- `bun test --test-name-pattern="^relation graph returns structured missing self duplicate and cycle issues$" ./tools/shared/tests/relation-graph.test.ts`

Contract:
- Decision Records 共享的关系图结构校验必须以结构化数据报告缺失目标、自环、同 source/target 重复和环，而不在共享层拼接领域诊断文本。

Proves:
- 缺失目标、自环、重复边和闭合环各自保留可定位的 edge 或 cycle 数据。
- Trace 不把缺失目标作为图内节点或内部边返回。
