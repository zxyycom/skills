### Case TASK-GRAPH-LEASE-RECOVERY-001: 过期占有通过显式恢复接管

Tests:
- `test:21a484de21f65c3f12c39d4fe278d4e486025cd6a9c5da06b8fe31431639c052`

Tags:
- `task-graph`

Contract:
- 过期 task 的恢复 claim 需要正确旧 lease、当前 revision 与原因，接管须保留递增 attempt 证据。

Proves:
- 错误旧 lease 报 LEASE_CONFLICT，无恢复参数报 LEASE_EXPIRED；投影为 recovery-needed/actionable，正确恢复写新 actor/lease 与 attempt=2 的完整执行态。
