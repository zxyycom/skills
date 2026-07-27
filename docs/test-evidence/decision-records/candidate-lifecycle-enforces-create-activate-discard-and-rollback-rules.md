### Case DECISION-CANDIDATE-LIFECYCLE-001: 候选决策生命周期受控

Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > candidate lifecycle enforces create, activate, discard, and rollback rules`
- `bun test --test-name-pattern="^candidate lifecycle enforces create, activate, discard, and rollback rules$" ./tools/decision-records/tests/run.ts`

Contract:
- 候选决策的创建、激活、丢弃与回滚必须遵循状态转换规则。

Proves:
- 合法转换更新状态，非法转换不修改决策集合。
