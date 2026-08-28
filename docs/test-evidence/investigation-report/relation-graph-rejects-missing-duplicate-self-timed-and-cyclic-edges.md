### Case INVESTIGATION-RELATION-GRAPH-VALIDATION-001: relation graph rejects missing duplicate self timed and cyclic edges

Entry:
- `tools/investigation-report/tests/relations.test.ts > relation graph rejects missing duplicate self timed and cyclic edges`
- `bun test --test-name-pattern="^relation graph rejects missing duplicate self timed and cyclic edges$" ./tools/investigation-report/tests/run.ts`

Contract:
- 关系图拒绝缺失目标、重复目标、自环、逆时间边和环。

Proves:
- 同一图返回各类结构与时间诊断。
