### Case NATIVE-RECORD-DECISION-PENDING-001: 决策身份操作保护 Git pending

Tests:
- `test:ca1bd12ee1d43d32f3699e8524a26545c16b12ecd5f6930c917b33171a1cdc56`
- `test:f85865be2e504eb5c957bb9aabc8958ba46b81611c3280d9908740b652b41d81`

Tags:
- `record-rust`

Contract:
- 决策身份操作不得覆盖域内已暂存内容或忽略 fresh 阶段的 pending 变化。

Proves:
- 真实 Git 验证域外 pending、域内冲突、历史不可用、unborn 和写前漂移。
