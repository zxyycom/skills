### Case INVESTIGATION-RELATION-GRAPH-SELF-001: relation graph rejects a self target

Entry:

- `tools/investigation-report/tests/relations.test.ts > relation graph rejects a self target`
- `bun test --test-name-pattern="^relation graph rejects a self target$" ./tools/investigation-report/tests/run.ts`

Contract:

- 报告不能把关系指向自身。

Proves:

- 自环返回 self-target 诊断。
