### Case INVESTIGATION-RESOURCE-OWNER-PREFIX-001: resource references use report IDs rather than topic paths or report indexes

Tests:
- `test:6a5b0bb59de52d61a6e42130095b01d8d596a271a29f1fab47c88735bc3017f4`

Tags:
- `investigation-report`

Contract:
- 资源 ID 使用 extensionless Investigation ID 作为 owner 前缀，不使用路径或索引位置。

Proves:
- 资源 owner ID 可反推为 extensionless 的报告 ID。
