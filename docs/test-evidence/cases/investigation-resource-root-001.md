### Case INVESTIGATION-RESOURCE-ROOT-001: resource root must be a directory when reports declare resources

Tests:
- `test:2fdcd34e69b75610659007fe49f0095334494999123b1d18b54b8bb7f477a66c`

Tags:
- `investigation-report`

Contract:
- 存在资源声明时 `_resources` 必须是目录。

Proves:
- 文件形式的资源根返回 must-be-directory 诊断。
