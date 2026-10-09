### Case CHANGE-PLAN-REPOSITORY-SCAN-SCOPE-001: 仓库扫描不越过活动真实目录边界

Tests:
- `test:7664b53d8711ea1584f86806fd5f310149164a45e3a457c0b8fbb62421f1288d`

Tags:
- `change-plan`
- `repository-boundary`

Contract:
- 仓库边界检查不跟随符号链接目录，也不读取 Change 根直属的私有 tombstone 区。

Proves:
- 外部符号链接目标及私有 tombstone 内都有 .git 目录时，集合查询仍无根错误，只返回有效的活动 Draft。
