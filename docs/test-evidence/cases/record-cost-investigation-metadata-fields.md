### Case RECORD-COST-CASE-021: 调查元数据跨字段匹配

Tests:
- `test:045ca118cdb50dc7cd62c08d5230734cbd8e026b3e21144f29aa83e99afdd2b4`

Tags:
- `record-cost`

Contract:
- all 查询允许同一调查记录跨字段聚合。

Proves:
- 匹配词分别位于 title 与 question 时返回命中记录及两个 matchedFields。
