### Case DECISION-EVOLVE-DISCARD-REFERENCE-001: Evolve discard 拒绝仍被引用的决策

Tests:
- `test:efb4923981eb9b1e51a80263326ca81e6cf001a47aa384a593e99e5d59756f58`

Tags:
- `decision-records`

Contract:
- 被剩余 candidate 或已建立记录引用的删除目标不能被 discard。

Proves:
- CLI 报告引用 ID，且不会修改后继、引用记录、目标或索引。
