### Case VERSION-CONTROL-PENDING-PATHS-001: 拒绝非法 Pending 替换路径且不产生写入

Tests:
- `test:6a313c94e7faa52aa44e8249025b9f544680e89b65d13a6b104dcd65268ecec0`

Tags:
- `version-control`

Contract:
- pending 替换只接受合法字面仓库相对范围、范围内目标路径和规范化后唯一的精确文件集合。

Proves:
- 范围外目标、重复目标和越界范围均返回 `invalid-path`。
- 完整 pending 快照保持不变。
