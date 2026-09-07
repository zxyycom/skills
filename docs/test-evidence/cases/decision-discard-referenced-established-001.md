### Case DECISION-DISCARD-REFERENCED-ESTABLISHED-001: Discard 拒绝仍被引用的已建立决策

Tests:
- `test:4bc42f08b68ad6d2a0b00428018c041843a638ae31eee674076b56a09e8a9b6e`

Tags:
- `decision-records`

Contract:
- 已建立决策仍被另一个已建立决策直接引用时不能删除；诊断应说明剩余引用，而不是把删除后的悬空 target 表现为普通图扫描错误。

Proves:
- 对已归档且仍被 active 后继引用的 Decision ID 执行 discard 返回 still referenced 诊断。
- 被选记录、引用后继和正式索引均保持不变。
