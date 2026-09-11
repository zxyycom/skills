### Case VERSION-CONTROL-PENDING-PATHS-001: 拒绝非法 Pending 替换路径且不产生写入

Tests:
- `test:43a1f7b877d15639b274743c6ccacc0a06eba28e6412baea20fcce85ee07377b`

Tags:
- `version-control`

Contract:
- pending 替换只接受合法字面仓库相对范围、范围内目标路径和规范化后唯一的精确文件集合。

Proves:
- 范围外目标、重复目标和越界范围均返回 `invalid-path`。
- 完整 pending 快照保持不变。
