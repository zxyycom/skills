### Case RESOURCE-CLI-CONTRACT-001: CLI 输出与结构错误

Tests:
- `test:4a577f6e01c50cd06a63c798a8270dd198d64b90364047cbbc3aafd548e926a0`
- `test:b8af7d351ea327ff0361f87620175f88cfde67754d012e22e1e000f293690b7d`

Tags:
- `resource-records`

Contract:
- CLI 区分 JSON 与普通输出通道、参数错误与记录错误；非法记录不生成索引。

Proves:
- 真实进程检查帮助、stderr 和退出码、JSON 错误 envelope，并拒绝缺字段、非法角色、重复 YAML 键及多目标。
