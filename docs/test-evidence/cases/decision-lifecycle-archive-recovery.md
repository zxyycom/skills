### Case DECISION-LIFECYCLE-ARCHIVE-RECOVERY-001: 归档与再启用保留创建身份

Tests:
- `test:4ee58a8599dbe20b59a7912395b9a236bab85e6430e936019a5ca6d421f879a5`

Tags:
- `decision-records`

Contract:
- 归档及再启用需有效索引与显式 alignment 确认，并保留 createdAt。

Proves:
- 坏 JSON 索引阻断 archive 且保留现场；显式同步后 archive 保留 aligned/createdAt，缺确认的 reactivate 零改动，确认后查询与严格检查通过且 createdAt 不变。
