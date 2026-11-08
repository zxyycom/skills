### Case INVESTIGATION-RESOURCE-OWNER-PREFIX-001: resource references use report IDs rather than topic paths or report indexes

Tests:
- `test:4e572abfeea52b35c3c4bffc062551f60a2a20ffd64dd908e460bd7d795d107a`

Tags:
- `investigation-report`

Contract:
- 调查资源 ID 的 owner 前缀必须由对应 owner 报告直接声明。

Proves:
- consumer 声明 230101-old/asset.png 时，索引图要求 230101-old 报告也声明该资源；补充声明后图通过。
