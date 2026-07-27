### Case DECISION-STATE-SNAPSHOT-001: 状态快照与后续源变更隔离
Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > state snapshots are isolated from later source mutations`
- `bun test --test-name-pattern="^state snapshots are isolated from later source mutations$" ./tools/decision-records/tests/run.ts`
Contract:
- 已返回的决策状态快照不得被后续源对象修改反向污染。
Proves:
- 修改原始对象后，既有快照内容保持不变。
