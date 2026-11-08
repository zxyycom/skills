### Case DECISION-EVOLVE-ARCHIVED-SUCCESSOR-001: 修订已归档后继的关系

Tests:
- `test:afe6902a186d39315ab34040d54f3b5b08e03fe8596bba28347a5aa2636244e6`

Tags:
- `decision-records`

Contract:
- 已归档后继可修订关系，但不得由此重新激活或改变 alignment、createdAt 和正文。

Proves:
- 原生事务先建立并归档后继，完整替换其关系后回读正文与索引：正文保持、status archived、alignment 与 createdAt 不变，新目标和摘要生效且新增活动前序归档。
