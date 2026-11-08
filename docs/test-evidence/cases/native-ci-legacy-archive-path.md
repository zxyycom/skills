### Case NATIVE-CI-LEGACY-ARCHIVE-PATH-001: 旧版验收基线提取路径

Tests:
- `test:e775550c9c5b7ab99d527ff9101e242aaafc8b5785fdfcdb5b6ad798cdbb0aa5`

Tags:
- `repository-tooling`

Contract:
- 旧版验收基线可提取到含空格和 Unicode 的隔离目录，不把宿主绝对路径传给 tar 的目标参数。

Proves:
- 使用真实 tar 创建并提取归档，核对目标文件字节；实际 Windows 路径解析由目标平台 CI 验证。
