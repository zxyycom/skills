### Case DECISION-LIFECYCLE-ARCHIVE-RECOVERY-001: 归档与再启用保留创建身份

Tests:
- `test:bec72ca5163aa1c73e59abc1d3d77761064a7861c2f807a07f5a6ea22bc65c4f`

Tags:
- `decision-records`

Contract:
- 归档及再启用需有效索引与显式 alignment 确认，并保留 createdAt。

Proves:
- 坏 JSON 索引阻断 archive 且保留现场；显式同步后 archive 保留 aligned/createdAt，缺确认的 reactivate 零改动，确认后查询与严格检查通过且 createdAt 不变。
