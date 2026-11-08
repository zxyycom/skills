### Case INVESTIGATION-SEARCH-MODES-001: 搜索 all 与 phrase 的跨段边界

Tests:
- `test:9815a50e99136096dbc2182a7348b6f9a194ba58f70ce292c5639ca58ca6d845`

Tags:
- `investigation-report`

Contract:
- 搜索匹配的 all 模式可跨段聚合词，phrase 模式不能跨段拼接。

Proves:
- 纯匹配器在两个文本段中以大小写及 NFKC 归一化命中 all；同样分段不构成 phrase 命中。
