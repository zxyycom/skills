### Case INVESTIGATION-RENAME-FORMAL-001: formal rename 闭合关系资源和索引

Tests:
- `test:6656cee40310a33f503da260d22cfd38617a5cd0f941816fd0ae78aea76eb9c0`

Tags:
- `investigation-report`

Contract:
- formal Investigation rename 必须在同一事务更新 formal/candidate relation、受管 resource link、owner tree、report sourcePath 与正式索引。

Proves:
- 旧 report 和 owner 路径消失，新 owner 文件、candidate/formal relation 与资源链接都使用新 ID。
- formal、candidate 与索引 relation 在改写 target 时逐字保留各自 summary。
- 正式索引只投影新 ID/sourcePath，严格同步检查通过。
