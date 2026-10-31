### Case TASK-GRAPH-LEASE-001: 续期与过期写入遵守 lease 有效期

Tests:
- `test:ac09486f5cfaf8c672bff47022dd45a7cd629b887bc0681d185a67f55072610a`

Tags:
- `task-graph`

Contract:
- 续期更新有效期，过期 lease 不能继续执行任何 lease-bound 写入。

Proves:
- 固定时刻续期得到精确 expiresAt，错误 lease 被拒绝；到期后 renew、release、complete、cancel 均报 LEASE_EXPIRED。
