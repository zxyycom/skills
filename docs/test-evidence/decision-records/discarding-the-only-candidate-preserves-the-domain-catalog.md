### Case DECISION-CANDIDATE-ONLY-001: 丢弃唯一候选仍保留域目录
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discarding the only candidate preserves the domain catalog`
- `bun test --test-name-pattern="^discarding the only candidate preserves the domain catalog$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策域不应因最后一个候选被丢弃而失去目录定义。
Proves:
- 候选删除后 domain catalog 仍存在且有效。
