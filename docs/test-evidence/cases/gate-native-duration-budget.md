### Case GATE-NATIVE-DURATION-BUDGET-001: CLI 按原生 duration 计算预算

Tests:
- `test:87c27bad4bfe1b47c7cc8e864e6f0a9e29b2ac769feb70d3a078fc90018b7ad3`

Tags:
- `repository-tooling`

Contract:
- 预算只消费原生实际 duration，null 不补零、实际零保留；quick 阻断，完整范围仅报告。

Proves:
- 以受控 duration readback 验证 nearest-rank/P90/mean、null/zero、quick/full 退出与 machine summary。
