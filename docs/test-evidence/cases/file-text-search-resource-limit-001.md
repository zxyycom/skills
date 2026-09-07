### Case FILE-TEXT-SEARCH-RESOURCE-LIMIT-001: 文件搜索在候选和字节扫描前执行资源限制

Tests:
- `test:1f4145374b2f9a1525327dc125269cb7e1c41141706ff73bea202e4b22b04a79`

Tags:
- `index-runtime`

Contract:
- 文件文本搜索必须在无界候选枚举、单文件读取和累计读取前执行配置的资源限制。

Proves:
- 超过候选文件数、单文件字节数或累计字节数上限时均拒绝为 resource-limit 错误。
