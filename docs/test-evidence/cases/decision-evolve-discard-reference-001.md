### Case DECISION-EVOLVE-DISCARD-REFERENCE-001: Evolve discard 拒绝仍被引用的决策

Tests:
- `test:843856f22119720fe5370ebd355d581ba5c88d521051e54967bfc1bcac5ef2fe`

Tags:
- `decision-records`

Contract:
- 被剩余 candidate 或已建立记录引用的删除目标不能被 discard。

Proves:
- CLI 报告引用 ID，且不会修改后继、引用记录、目标或索引。
