### Case INVESTIGATION-RELATION-GRAPH-TIME-001: relation graph rejects a target formed later

Entry:

- `tools/investigation-report/tests/relations.test.ts > relation graph rejects a target formed later`
- `bun test --test-name-pattern="^relation graph rejects a target formed later$" ./tools/investigation-report/tests/run.ts`

Contract:

- 关系 target 的 formedAt 不得晚于 source。

Proves:

- 指向形成更晚报告的关系返回时间诊断。
