### Case DECISION-LIST-FACETS-001: Decision list facets 对完整 snapshot 确定聚合

Tests:
- `test:fa3b5f6e897804d4c3bb804e8b8091a78c5e8d55def86fc2cb868ae82595d9a1`

Tags:
- `decision-records`

Contract:
- Decision list facets 从同一完整 entries snapshot 查询时聚合记录、status、alignment、每记录唯一 tag、UTC 月份和规范时间边界；空集合使用唯一空表示。

Proves:
- 空集合、跨 UTC 月边界、重复 tag 和两种明确 alignment 得到确定计数、排序与时间边界；facets 只包含 aligned、unaligned，重复聚合结果深度相等。
