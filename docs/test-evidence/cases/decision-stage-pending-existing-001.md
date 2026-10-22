### Case DECISION-STAGE-PENDING-EXISTING-001: Stage 拒绝已有 pending index

Tests:
- `test:dd56a05e82f17bcbd05e9c98d3447103d95d8c2cac3ca78c78047082d8e43204`

Tags:
- `decision-records`

Contract:
- 显式重选同一对象用工作区完整版本刷新，已有 pending 不构成冲突，相同结果不产生变化。

Proves:
- 同一正式对象连续 stage 两次均成功，第二次 writtenPaths 为空。
