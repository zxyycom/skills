### Case FILE-TEXT-SEARCH-LIMITED-RANGES-001: 有界范围保留匹配与合并语义

Tests:
- `test:b13d32dd18f927bc895314d2d248699f10887d8787901614a8422045c0835950`

Tags:
- `file-text-search`

Contract:
- 有界范围应保留 Unicode 原始坐标、重叠合并、跨行 all 和 phrase 的匹配及截断语义。

Proves:
- 对照完整匹配并以独立预期验证重叠链、跨行 all 和 Unicode phrase 结果。
