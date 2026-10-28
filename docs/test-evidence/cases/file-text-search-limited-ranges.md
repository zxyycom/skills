### Case FILE-TEXT-SEARCH-LIMITED-RANGES-001: 有界范围保留匹配与合并语义

Tests:
- `test:11ac3cc920b7f1f7c6f9a4d2a3c13d26e259bada96120a580e43a7ef64ff69bc`

Tags:
- `file-text-search`

Contract:
- 有界范围应保留 Unicode 原始坐标、重叠合并、跨行 all 和 phrase 的匹配及截断语义。

Proves:
- 对照完整匹配并以独立预期验证重叠链、跨行 all 和 Unicode phrase 结果。
