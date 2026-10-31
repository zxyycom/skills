### Case INVESTIGATION-RESOURCE-REVISION-001: resource byte changes do not change the report index source revision

Tests:
- `test:0d7e44b030fb8001acb8cd069c3724274df9c22d1bd1935682609ecbdf19e932`

Tags:
- `investigation-report`

Contract:
- 资源字节不进入报告 index source revision。

Proves:
- 在真实资源文件从 `one` 改为 `two` 后完整验证仍成功，index 的 sourceRevision 保持相同。
