### Case TASK-GRAPH-CLI-ARGUMENTS-001: 歧义执行前置条件、缺失 reason 和多余 reason 均以 ARGUMENT_INVALID 拒绝

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI rejects ambiguous lease and revision pairs plus invalid control reasons`
- `bun test --test-name-pattern="^CLI rejects ambiguous lease and revision pairs plus invalid control reasons$" ./tools/task-graph/tests/run.ts`

Contract:
- complete/cancel 必须且只能提供 lease 或 expectedRevision 之一，control 与 reason 必须组成合法组合。

Proves:
- 执行前置条件同给或都不给、缺失 reason 和多余 reason 均以 `ARGUMENT_INVALID` 拒绝。
