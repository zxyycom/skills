### Case DECISION-LIFECYCLE-ALIGNMENT-RECOVERY-001: 对齐前必须显式恢复缺失索引

Tests:
- `test:544f7f11812fcfa2bee351b18c48ccb7410c28fee991ba3d6ea9b7e9fa50d840`

Tags:
- `decision-records`

Contract:
- mark-aligned 依赖可信的已发布索引，缺失时不隐式重建。

Proves:
- 缺索引时 mark-aligned 失败且不写来源/索引；显式 sync-index 恢复 unaligned 后 mark-aligned 成功写为 aligned。
