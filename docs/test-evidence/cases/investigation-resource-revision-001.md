### Case INVESTIGATION-RESOURCE-REVISION-001: resource byte changes do not change the report index source revision

Tests:
- `test:5d2d63be8c56264a62bc2126449d6d3c8cba9ee3afd31c2c8d1055acd52622f0`

Tags:
- `investigation-report`

Contract:
- 资源字节不进入报告 index source revision。

Proves:
- 在真实资源文件从 `one` 改为 `two` 后完整验证仍成功，index 的 sourceRevision 保持相同。
