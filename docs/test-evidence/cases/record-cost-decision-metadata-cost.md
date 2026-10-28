### Case RECORD-COST-CASE-024: 决策元数据无需高亮范围匹配

Tests:
- `test:de5af59b22722c748fc9fcc039f32ff4b8e7bcd42c4d3976efcbef14d317b215`

Tags:
- `record-cost`

Contract:
- 决策 metadata 精确计数及字段投影不需要高亮范围。

Proves:
- 100 条命中返回精确计数和字段，grapheme 分段为零。
