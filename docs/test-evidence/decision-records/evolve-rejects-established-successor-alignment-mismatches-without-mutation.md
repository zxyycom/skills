### Case DECISION-EVOLVE-ALIGNMENT-CONFIRMATION-001: Evolve 拒绝已建立后继的错误对齐确认
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects established successor alignment mismatches without mutation`
- `bun test --test-name-pattern="^evolve rejects established successor alignment mismatches without mutation$" ./tools/decision-records/tests/run.ts`
Contract:
- 选择已建立后继时，`--successor` 中的 alignment 只能确认记录现有对齐状态，不能借关系事务改写对齐。
Proves:
- 与现状不一致的 alignment 返回明确失败诊断。
- 拒绝路径逐字节保留目标 Markdown 和 decision-index.json。
