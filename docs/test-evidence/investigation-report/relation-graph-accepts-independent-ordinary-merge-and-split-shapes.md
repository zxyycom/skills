### Case INVESTIGATION-RELATION-GRAPH-SHAPES-001: relation graph accepts independent ordinary merge and split shapes

Entry:
- `tools/investigation-report/tests/relations.test.ts > relation graph accepts independent ordinary merge and split shapes`
- `bun test --test-name-pattern="^relation graph accepts independent ordinary merge and split shapes$" ./tools/investigation-report/tests/run.ts`

Contract:
- 关系图接受独立报告、普通单前序、纯归并和闭合拆分形状。

Proves:
- 合法普通、归并和双后继拆分集合不产生错误。
