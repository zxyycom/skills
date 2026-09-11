### Case DECISION-DISCARD-REFERENCED-ESTABLISHED-001: Discard 拒绝仍被引用的已建立决策

Tests:
- `test:b4df4bb188edd32541b52807c678a272a18f400344f3f92067ffff88a6258e44`

Tags:
- `decision-records`

Contract:
- 已建立决策仍被另一个已建立决策直接引用时不能删除；诊断应说明剩余引用，而不是把删除后的悬空 target 表现为普通图扫描错误。

Proves:
- 对已归档且仍被 active 后继引用的 Decision ID 执行 discard 返回 still referenced 诊断。
- 被选记录、引用后继和正式索引均保持不变。
