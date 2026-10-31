### Case FILE-TEXT-SEARCH-UNICODE-CASE-001: 文件搜索按整行处理希腊 sigma 小写

Tests:
- `test:6a95ee240f7cf83dda11035afad584ce6b3bf51ff247c176780b76cfd42d342b`

Tags:
- `index-runtime`

Contract:
- 无大小写差异的文件文本匹配必须按整行小写语义处理有上下文形式的 Unicode 字符。

Proves:
- 全大写希腊词可由带词尾 sigma 的小写短语查询匹配。
- 返回原始行和覆盖整词的原始范围。
