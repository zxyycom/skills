### Case TASK-GRAPH-MUTATION-PRECONDITIONS-001: 终态动作要求唯一写入前提

Tests:
- `test:d4553d81144e782235b88dc5da33b1b9c4d8a9a6be3436f3e2013f5af2b9e0e9`

Tags:
- `task-graph`

Contract:
- complete/cancel 必须且只能指定 leaseId 或 expectedRevision 中之一。

Proves:
- 缺少两者与同时指定两者均由 complete/cancel 返回 ARGUMENT_INVALID。
