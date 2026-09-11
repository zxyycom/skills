### Case DECISION-CLI-UNKNOWN-OPTION-001: CLI 拒绝未知选项

Tests:
- `test:db3bf49eca53a5272dcbee6a3f30934d3759e53104da18bcca907aeb278cc5cb`

Tags:
- `decision-records`

Contract:
- 各子命令必须在参数边界拒绝未声明选项并使用参数错误退出码。

Proves:
- List 与 archive 收到 `--unknown-option` 时均退出 2 并报告 unknown option。
