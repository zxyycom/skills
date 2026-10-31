### Case TASK-GRAPH-MUTATION-PRECONDITIONS-001: 终态动作要求唯一写入前提

Tests:
- `test:2f9386ac481df4a859f9c5483b59656b6a374673e1f405a6078953ece7023e1f`

Tags:
- `task-graph`

Contract:
- complete/cancel 必须且只能指定 leaseId 或 expectedRevision 中之一。

Proves:
- 缺少两者与同时指定两者均由 complete/cancel 返回 ARGUMENT_INVALID。
