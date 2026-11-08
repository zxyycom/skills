### Case INVESTIGATION-RESOURCE-ROOT-001: 有引用时资源根必须为目录

Tests:
- `test:f305d1446702243fdb39186c40af0f8221d5bc2bdc605fc0da5ab58834fa4f48`

Tags:
- `investigation-report`

Contract:
- 报告声明资源时 _resources 根必须为目录。

Proves:
- full check 在 _resources 为普通文件时返回 resource-invalid；恢复目录及资源文件后检查通过。
