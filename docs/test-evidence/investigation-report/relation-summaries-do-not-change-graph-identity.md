### Case INVESTIGATION-RELATION-SUMMARY-GRAPH-001: relation summaries do not change graph identity or validation

Entry:

- `tools/investigation-report/tests/relations.test.ts > relation summaries do not change graph identity or validation`
- `bun test --test-name-pattern="^relation summaries do not change graph identity or validation$" ./tools/investigation-report/tests/run.ts`

Contract:

- summary 只是边显示信息，不参与 type/target 身份、重复判断、关系形状或其他拓扑验证。

Proves:

- 仅增添不同 summary 的相同关系集合与无摘要集合产生完全相同的图验证结果。
- 相同 target 仍被判为重复，摘要不能制造可共存的新边。
