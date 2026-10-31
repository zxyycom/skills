### Case DECISION-DISCARD-REFERENCED-ESTABLISHED-001: Discard 拒绝仍被引用的已建立决策

Tests:
- `test:e4002b0fdf18f18c81c87b010ebac32aff59a34c39487600ad5565f5779bedaf`

Tags:
- `decision-records`

Contract:
- 已建立决策仍被另一个已建立决策直接引用时不能删除；诊断应说明剩余引用，而不是把删除后的悬空 target 表现为普通图扫描错误。

Proves:
- 纯生命周期准备拒绝仍被 active 后继引用的 archived 目标，返回 still referenced 错误且结果不含 changes。
