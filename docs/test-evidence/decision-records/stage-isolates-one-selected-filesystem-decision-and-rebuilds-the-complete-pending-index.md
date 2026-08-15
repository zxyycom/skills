### Case DECISION-STAGE-ISOLATION-001: Stage 隔离未选择的文件系统变更

Entry:
- `tools/decision-records/tests/stage.test.ts > stage isolates unselected filesystem changes`
- `bun test --test-name-pattern="^stage isolates unselected filesystem changes$" ./tools/decision-records/tests/run.ts`

Contract:
- Stage 仅暂存选择的 Decision ID 与派生索引，不携带未选择的 filesystem 变更。

Proves:
- 未选 candidate 不进入暂存区。
