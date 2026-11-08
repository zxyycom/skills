### Case INVESTIGATION-SEARCH-CURRENT-IDENTITY-001: Investigation 非命中身份仍核对

Tests:
- `test:14db0289cf9151b67118ad2bce522b41a2996694f9eb8b7cdf2862a6147204e5`

Tags:
- `record-search`

Contract:
- content 搜索对所选来源的身份和编码错误必须失败，即使查询词不命中。

Proves:
- 非法 UTF-8 与不匹配的声明 ID 均令 content 搜索失败，查询词为 missing。
