### Case INVESTIGATION-SNAPSHOT-DUPLICATE-STATE-001: State Snapshot 拒绝重复的主题路径投影

Entry:
- `tools/investigation-report/tests/index-query.test.ts > state snapshots reject duplicate state paths`
- `bun test --test-name-pattern="^state snapshots reject duplicate state paths$" ./tools/investigation-report/tests/run.ts`

Contract:
- 创建调查 state snapshot 时，每个主题路径只能投影一个 state；重复路径不能被静默覆盖或合并。

Proves:
- 为同一 source 路径传入两个同路径 state 时，`createInvestigationStateSnapshot` 抛出包含该路径与 duplicate state projection 原因的错误。
