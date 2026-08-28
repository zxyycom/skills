### Case INVESTIGATION-RELATION-GRAPH-VALIDATION-001: relation graph rejects a missing target

Entry:

- `tools/investigation-report/tests/relations.test.ts > relation graph rejects a missing target`
- `bun test --test-name-pattern="^relation graph rejects a missing target$" ./tools/investigation-report/tests/run.ts`

Contract:

- 报告关系的 target 必须属于当前报告集合。

Proves:

- 指向缺失报告的关系返回 missing-target 诊断。
