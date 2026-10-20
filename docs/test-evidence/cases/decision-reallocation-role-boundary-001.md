### Case DECISION-REALLOCATION-ROLE-BOUNDARY-001: Evolve 拒绝重划角色重叠

Tests:
- `test:abb8f2f4525dc612873272d95c1127cd785b737faf5243086476d8e3a13a11db`

Tags:
- `decision-records`

Contract:
- 单次重划不得把同一个 Decision ID 同时作为所选后继和直接前序，避免把两代关系折叠进一个事件。

Proves:
- 纯事务准备对选择既有重划后继、同时让新候选指向它的输入返回 error、exitCode=1 和 successor/predecessor 角色重叠诊断，且不产生 changes。
