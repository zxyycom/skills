### Case DECISION-LIST-FACETS-001: Decision list facets 对完整 snapshot 确定聚合

Tests:
- `test:dd365ce569f29e3e67d5b284b50765e2c84a77a592b3616edd96952ffffc0d12`

Tags:
- `decision-records`

Contract:
- Decision list facets 从同一完整 entries snapshot 查询时聚合记录、status、alignment、每记录唯一 tag、UTC 月份和规范时间边界；空集合使用唯一空表示，聚合为单次线性遍历。

Proves:
- 空集合、跨 UTC 月边界、重复 tag、未知 alignment 和 10,000 条合成 entries 得到确定计数、排序与时间边界，重复聚合结果深度相等。
