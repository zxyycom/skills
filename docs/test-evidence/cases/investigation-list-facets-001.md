### Case INVESTIGATION-LIST-FACETS-001: Investigation list facets 对完整 snapshot 确定聚合

Tests:
- `test:0602785487542ec4679e253b3314ad10c1d0bed1c712f114d86b9641edc30df2`

Tags:
- `investigation-report`

Contract:
- Investigation list facets 从同一完整 entries snapshot 查询时聚合记录、每记录唯一 tag、UTC 月份和规范时间边界；空集合使用唯一空表示。

Proves:
- 空集合、跨 UTC 月边界和重复 tag 得到确定计数、排序与时间边界，重复聚合结果深度相等。
