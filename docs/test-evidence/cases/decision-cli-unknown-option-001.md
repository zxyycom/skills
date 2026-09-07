### Case DECISION-CLI-UNKNOWN-OPTION-001: CLI 拒绝未知选项

Tests:
- `test:1bccbe3ca87d9a409f54544178b91348040742a54a638b322bbeac3348563b58`

Tags:
- `decision-records`

Contract:
- 各子命令必须在参数边界拒绝未声明选项并使用参数错误退出码。

Proves:
- List 与 archive 收到 `--unknown-option` 时均退出 2 并报告 unknown option。
