### Case RECORD-COST-CASE-017: 调查元数据无需高亮范围匹配

Tests:
- `test:5f4ae171d7f05749fdedc7fc31b60ca97cf27d0163819e63a6504f782176fd05`

Tags:
- `record-cost`

Contract:
- 调查 metadata 精确计数及字段投影不需要高亮范围。

Proves:
- 100 条命中返回精确计数和字段，grapheme 分段为零。
