### Case INVESTIGATION-DISCARD-RESOURCE-ID-001: discard rejects illegal owner resource IDs without deleting the report

Tests:
- `test:aea3fd6da96e68809dc4e98d48bedef7d8eca44e2dcab71573732add626c2908`

Tags:
- `investigation-report`

Contract:
- 删除前必须拒绝不符合受管资源 ID 规则的 owner 文件路径。

Proves:
- 检测到非法 `%` 路径时无写入，报告保持存在。
