### Case DECISION-RELATION-GRAPH-MISSING-TRACE-001: 共享关系图追踪不包含缺失 target

Entry:

- `tools/shared/tests/relation-graph.test.ts > relation graph traces do not include missing targets`
- `bun test --test-name-pattern="^relation graph traces do not include missing targets$" ./tools/shared/tests/relation-graph.test.ts`

Contract:

- 缺失 target 不是图内节点，也不能出现在 trace 内部边。

Proves:

- predecessor trace 不返回缺失 ID 或指向缺失 ID 的内部边。
