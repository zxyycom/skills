### Case TASK-GRAPH-LEASE-DURATION-001: lease 时长使用闭区间边界

Tests:
- `test:3a0c19089bda176fea348b4c099f74cfe28b8a4d2145ad09c1af3876818757b5`

Tags:
- `task-graph`

Contract:
- claim 时长允许 60–86400 秒闭区间。

Proves:
- 59/86401 秒被拒绝，60/86400 秒对应精确 expiresAt 字面预期。
