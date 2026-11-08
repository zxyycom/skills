### Case RECORD-SEARCH-COUNTS-001: 首个隐藏命中的早停与末文件精确计数

Tests:
- `test:240bb720033ffe3ca825886da9faf5c2fbfa402bc9081312c1ddd74e6150c5ca`
- `test:cb3719729c8cf2c45c7619caa51da8d712fcdef71bc1e97f72f57145d4c44eed`
- `test:ddbd96e2d971a31fe060b1438e6a09f5cd2ba43f256b43680752bdb2a89a8c85`

Tags:
- `record-search`

Contract:
- 返回预算满后在首个隐藏命中处停止并计数；存在未扫描文件为 lower-bound，最后文件为 exact。

Proves:
- Investigation 原生 content 搜索在三个候选文件中于第二个命中后早停，matched 为 lower-bound 2、returned 为 1 且 scanComplete 为 false。
- 两个文件均已读取时，首个隐藏命中计入 exact 2，returned 为 1、结果受限而预览完整；该节点不单独证明 Decision 接线。
- 共享文件搜索节点另对未扫描文件情况下首个隐藏命中给出 lower-bound，不证明两域原生 CLI 接线。
