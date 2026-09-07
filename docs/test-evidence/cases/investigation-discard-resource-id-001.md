### Case INVESTIGATION-DISCARD-RESOURCE-ID-001: discard rejects illegal owner resource IDs without deleting the report

Tests:
- `test:cca6f8a5a769ac3f82b8e23f35e58e6a101dd3c958c963a65e3dab383c77e8b1`

Tags:
- `investigation-report`

Contract:
- 删除前必须拒绝不符合受管资源 ID 规则的 owner 文件路径。

Proves:
- 检测到非法 `%` 路径时无写入，报告保持存在。
