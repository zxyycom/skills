### Case NATIVE-UPDATER-CLI-CONFIRM-001: 未确认安装不写入

Tests:
- `test:86d321829f76a7e4be87d3e9d31e05a72d2093c1ed9399ae4154447fd7eeaa61`

Tags:
- `repository-tooling`

Contract:
- 未确认时不得创建目标。

Proves:
- 非交互环境中缺少确认返回失败，多级目标保持不存在；交互 TTY 不由此节点证明。
