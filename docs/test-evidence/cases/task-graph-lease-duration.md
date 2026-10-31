### Case TASK-GRAPH-LEASE-DURATION-001: lease 时长使用闭区间边界

Tests:
- `test:a8e2ab5503b5729370f2bdbd4dc92dff7ccffa1828c8512519c20003a06357cc`

Tags:
- `task-graph`

Contract:
- claim 时长允许 60–86400 秒闭区间。

Proves:
- 59/86401 秒被拒绝，60/86400 秒对应精确 expiresAt 字面预期。
