### Case DECISION-LOCAL-MAINTENANCE-ISOLATION-001: 正式改名隔离未选正文损坏

Tests:
- `test:a4bb51c4ed620d35e05bc6068e7e348a40ef470ecb7bd1a2eec2bdc02bd3d0c3`

Tags:
- `decision-records`

Contract:
- 普通正式 rename 不以未选且不受影响的正式正文健康为门禁。

Proves:
- 未选正式正文损坏时所选记录改名成功，未选正文原字节与其索引路径保持。
