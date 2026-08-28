### Case DECISION-RELATION-GRAPH-ORDERING-001: 共享关系图按 UTF-16 代码单元排序标识符

Entry:

- `tools/shared/tests/relation-graph.test.ts > relation graph orders identifiers by UTF-16 code units`
- `bun test --test-name-pattern="^relation graph orders identifiers by UTF-16 code units$" ./tools/shared/tests/relation-graph.test.ts`

Contract:

- 共享图排序不得依赖 locale。

Proves:

- 大小写与连字符组合按 UTF-16 代码单元的稳定顺序投影。
