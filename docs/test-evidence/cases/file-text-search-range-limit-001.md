### Case FILE-TEXT-SEARCH-RANGE-LIMIT-001: 文件搜索按实际范围限制命中

Tests:
- `test:9f31bbbda79b1267cb074c49daf97b38f23c314dc8da1abd5cb7d5e7bc03da24`

Tags:
- `index-runtime`

Contract:
- 每文件命中上限按实际命中范围而非按匹配行计数。

Proves:
- 同一行有两个匹配范围时，上限为一仅返回第一个范围。
- 被省略的后续范围使 matches 截断标志为 true。
