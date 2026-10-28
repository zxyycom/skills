### Case RECORD-COST-CASE-017: 调查元数据无需高亮范围匹配

Tests:
- `test:b11040aa68e04ec6972d3063eaee800a947b5ed73fb26af0b80a7fcb37e81257`

Tags:
- `record-cost`

Contract:
- 调查 metadata 精确计数及字段投影不需要高亮范围。

Proves:
- 100 条命中返回精确计数和字段，grapheme 分段为零。
