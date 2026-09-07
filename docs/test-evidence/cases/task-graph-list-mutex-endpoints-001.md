### Case TASK-GRAPH-LIST-MUTEX-ENDPOINTS-001: Run mutex 使用实际 endpoint ID 与所在 track label

Tests:
- `test:f9b998a5739e30ee4a1365b1caeca2758da00d09102a4939389fc4495a1e6531`

Tags:
- `task-graph`

Contract:
- Run mutex 的关系身份始终是实际 task ID；track label 只定位 endpoint 当前所在 track，同一 pair 可以跨 track 或位于同一 track。

Proves:
- 跨 track pair 逐字节输出 T01/task-000001 与 T02/task-000002。
- Same-track pair 的两个实际 task ID 都使用共享的 T01，且不生成虚假的 T02。
