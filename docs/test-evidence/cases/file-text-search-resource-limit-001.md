### Case FILE-TEXT-SEARCH-RESOURCE-LIMIT-001: 文件搜索在候选和字节扫描前执行资源限制

Tests:
- `test:ee128cedc6a5f6f5256e109ccf73575630e4e840a2f65c134b4a5aa2d034ba91`

Tags:
- `index-runtime`

Contract:
- 文件文本搜索必须在无界候选枚举、单文件读取和累计读取前执行配置的资源限制。

Proves:
- 超过候选文件数、单文件字节数或累计字节数上限时均拒绝为 resource-limit 错误。
