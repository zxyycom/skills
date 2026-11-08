### Case NATIVE-LEGACY-ROLLBACK-001: 激活前失败恢复旧安装

Tests:
- `test:16921649cf92c3f71c32fbdf485d73e7375ca4884876631260de8f12014a2654`

Tags:
- `repository-tooling`

Contract:
- 旧版原地交接在新说明激活前验证失败时，应恢复本次覆盖文件并移除本次新增文件。

Proves:
- 私有 fixture 注入最终路径验证失败后，旧入口、权限与旧文件恢复，新增二进制和 receipt 不存在，无关文件保留。
