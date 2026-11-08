### Case DECISION-EVOLVE-ESTABLISHED-REPLACE-001: 已建立记录完整替换关系

Tests:
- `test:afe6902a186d39315ab34040d54f3b5b08e03fe8596bba28347a5aa2636244e6`

Tags:
- `decision-records`

Contract:
- 修订已建立记录时完整替换关系并保留正文和生命周期状态。

Proves:
- 以已归档后继替换旧修订边为新替代边，实际读取原文正文和索引验证正文、status、alignment、createdAt 不变，索引仅含新目标与摘要；该节点未断言 review 差异或重复执行 unchanged。
