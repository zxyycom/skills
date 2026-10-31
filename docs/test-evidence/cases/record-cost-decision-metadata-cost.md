### Case RECORD-COST-CASE-024: 决策元数据无需高亮范围匹配

Tests:
- `test:40aa722b58ae3bd1c60c0e6f33b7f6e51a7277662290ada93b51db2b71b41cc1`

Tags:
- `record-cost`

Contract:
- 决策 metadata 精确计数及字段投影不需要高亮范围。

Proves:
- 100 条命中返回精确计数和字段，grapheme 分段为零。
