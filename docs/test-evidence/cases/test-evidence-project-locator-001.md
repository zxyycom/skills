### Case TEST-EVIDENCE-PROJECT-LOCATOR-001: 注册实体身份保留直接文件与完整测试名

Tests:
- `test:803f6c984bd975b3ca7c999aa6e8fe5c13250d3db6e4d2b8aac67f1d6aa2a132`

Tags:
- `repository-tooling`

Contract:
- 项目注册实体必须提供 POSIX 相对测试文件与完整测试名组成的直接 locator，供引用检查和旧 Case 迁移精确映射。

Proves:
- 生成实体包含直接 file > full test name locator，并与 runner 选择信息保持可追溯的一致身份。
