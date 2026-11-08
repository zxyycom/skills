### Case INVESTIGATION-RESOURCE-TYPE-001: 随附资源目标必须为普通文件

Tests:
- `test:f305d1446702243fdb39186c40af0f8221d5bc2bdc605fc0da5ab58834fa4f48`

Tags:
- `investigation-report`

Contract:
- 报告引用的资源目标必须是普通文件。

Proves:
- full check 在资源路径为目录时返回 resource-invalid；恢复为普通文件后检查通过。
