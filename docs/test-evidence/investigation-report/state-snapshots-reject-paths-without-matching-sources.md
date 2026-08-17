### Case INVESTIGATION-SNAPSHOT-SOURCE-MEMBERSHIP-001: State Snapshot 拒绝来源集合外的 State 路径

Entry:
- `tools/investigation-report/tests/index-query.test.ts > state snapshots reject paths without matching sources`
- `bun test --test-name-pattern="^state snapshots reject paths without matching sources$" ./tools/investigation-report/tests/run.ts`

Contract:
- 调查 state snapshot 中的每个 state 路径必须属于其 source 集合；不得向索引投影不存在对应 Markdown source 的主题状态。

Proves:
- state 路径不在 source 集合中时，`createInvestigationStateSnapshot` 抛出包含该路径与 no matching source 原因的错误。
