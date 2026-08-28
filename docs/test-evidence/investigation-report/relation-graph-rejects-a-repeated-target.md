### Case INVESTIGATION-RELATION-GRAPH-DUPLICATE-001: relation graph rejects a repeated target

Entry:

- `tools/investigation-report/tests/relations.test.ts > relation graph rejects a repeated target`
- `bun test --test-name-pattern="^relation graph rejects a repeated target$" ./tools/investigation-report/tests/run.ts`

Contract:

- 同一报告不能向同一 target 声明多个关系类型。

Proves:

- 重复 target 恰好返回一条可定位的重复关系诊断。
