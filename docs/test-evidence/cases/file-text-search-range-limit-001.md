### Case FILE-TEXT-SEARCH-RANGE-LIMIT-001: 文件搜索按实际范围限制命中

Tests:
- `test:a0668935552b498dbc582f3914420023883be0c35953380781b266942a7f428c`

Tags:
- `index-runtime`

Contract:
- 每文件命中上限按实际命中范围而非按匹配行计数。

Proves:
- 同一行有两个匹配范围时，上限为一仅返回第一个范围。
- 被省略的后续范围使 matches 截断标志为 true。
