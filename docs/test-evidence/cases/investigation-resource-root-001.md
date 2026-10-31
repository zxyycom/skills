### Case INVESTIGATION-RESOURCE-ROOT-001: resource root must be a directory when reports declare resources

Tests:
- `test:b4924e7dea80ca6f9830b4aa35e299acd83e436b659977ebb92fb7191d80b5ae`

Tags:
- `investigation-report`

Contract:
- 存在资源声明时 `_resources` 必须是目录。

Proves:
- 文件形式的资源根返回 must-be-directory 诊断。
