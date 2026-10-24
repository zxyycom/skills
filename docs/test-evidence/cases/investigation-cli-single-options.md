### Case INVESTIGATION-CLI-SINGLE-OPTIONS-001: 重复单值 CLI 选项不创建集合文件

Tests:
- `test:21b4502b6054398add0c699e671c83c2a8b96bd796f1f90be1fbaf6ec20a00f7`

Tags:
- `investigation-report`

Contract:
- 重复单值选项作为 usage 错误拒绝，不能创建候选或集合文件。

Proves:
- 各重复单值选项返回 usage 失败，fixture 下没有创建 collection/candidate 文件。
