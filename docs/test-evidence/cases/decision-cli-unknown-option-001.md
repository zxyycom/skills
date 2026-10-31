### Case DECISION-CLI-UNKNOWN-OPTION-001: CLI 拒绝未知选项

Tests:
- `test:20ba0b7acf2bd72ff0d239acb817090dda61cf1812d5b9ce1fe13067594661ae`

Tags:
- `decision-records`

Contract:
- 各子命令必须在参数边界拒绝未声明选项并使用参数错误退出码。

Proves:
- List 与 archive 收到 `--unknown-option` 时均退出 2 并报告 unknown option。
