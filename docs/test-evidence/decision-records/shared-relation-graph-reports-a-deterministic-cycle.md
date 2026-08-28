### Case DECISION-RELATION-GRAPH-CYCLE-001: 共享关系图报告确定性环

Entry:

- `tools/shared/tests/relation-graph.test.ts > relation graph reports a deterministic cycle`
- `bun test --test-name-pattern="^relation graph reports a deterministic cycle$" ./tools/shared/tests/relation-graph.test.ts`

Contract:

- 共享图结构校验必须以确定性的闭合路径报告环。

Proves:

- 同一环从规范最小 ID 开始并闭合返回。
