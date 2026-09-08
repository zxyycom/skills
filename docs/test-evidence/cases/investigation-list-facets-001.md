### Case INVESTIGATION-LIST-FACETS-001: Investigation list facets 对完整 snapshot 确定聚合

Tests:
- `test:d06e0893124ab85684eb2b89a6da0c77e4933ebc54855a483173efe2193fea59`

Tags:
- `investigation-report`

Contract:
- Investigation list facets 从同一完整 entries snapshot 查询时聚合记录、每记录唯一 tag、UTC 月份和规范时间边界；空集合使用唯一空表示，聚合为单次线性遍历。

Proves:
- 空集合、跨 UTC 月边界、重复 tag 和 10,000 条合成 entries 得到确定计数、排序与时间边界，重复聚合结果深度相等。
