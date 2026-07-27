### Case DECISION-EVOLVE-ARCHIVED-PREDECESSOR-001: Evolve 拒绝已归档直接前序
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects archived predecessors without mutation`
- `bun test --test-name-pattern="^evolve rejects archived predecessors without mutation$" ./tools/decision-records/tests/run.ts`
Contract:
- Evolve 只能归档当前活动的直接前序，不得把已归档记录作为待转换来源。
Proves:
- 包含已归档前序的演进退出 1 并报告 predecessor 状态错误，候选与索引保持不变。
