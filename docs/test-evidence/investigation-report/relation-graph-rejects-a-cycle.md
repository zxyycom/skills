### Case INVESTIGATION-RELATION-GRAPH-CYCLE-001: relation graph rejects a cycle

Entry:

- `tools/investigation-report/tests/relations.test.ts > relation graph rejects a cycle`
- `bun test --test-name-pattern="^relation graph rejects a cycle$" ./tools/investigation-report/tests/run.ts`

Contract:

- 报告关系图必须无环。

Proves:

- 闭合关系返回 cycle 诊断。
