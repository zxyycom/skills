### Case NATIVE-UPDATER-CLI-CHECK-001: 原生版本检查只读

Tests:
- `test:a5b8fcb03ba8a25cf4e241167710cf30ec49edcef01b12bd886de1af968eda07`

Tags:
- `repository-tooling`

Contract:
- 检查仅比较版本，不下载归档或修改目标。

Proves:
- 模拟 release 只请求 release 和 manifest，已安装包文件的字节与权限不变；不验证文件健康。
