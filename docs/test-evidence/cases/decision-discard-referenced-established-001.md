### Case DECISION-DISCARD-REFERENCED-ESTABLISHED-001: Discard 拒绝仍被引用的已建立决策

Tests:
- `test:ace078cbf203c835d7f02c733fb568d9c7c20c08e23edfc125fcbdd8e2b575fc`

Tags:
- `decision-records`

Contract:
- 已建立决策仍被另一个已建立决策直接引用时不能删除；诊断应说明剩余引用，而不是把删除后的悬空 target 表现为普通图扫描错误。

Proves:
- 原生事务预检拒绝被 active 后继引用的 archived 目标；诊断指向被删 ID、原因包含引用者 ID，恢复提示提及关系。
