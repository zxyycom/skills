### Case CHANGE-PLAN-REPOSITORY-SCAN-SCOPE-001: 仓库扫描不越过活动真实目录边界

Tests:
- `test:cc8007e5f9c6419e3bf8ef6bbb0d3bdd3e5503e9c9746fd6b6285b06a41093ef`

Tags:
- `change-plan`
- `repository-boundary`

Contract:
- 仓库边界检查不跟随符号链接目录，也不读取 Change 根直属的私有 tombstone 区。

Proves:
- 外部符号链接目标及私有 tombstone 内都有 .git 目录时，集合查询仍无根错误，只返回有效的活动 Draft。
