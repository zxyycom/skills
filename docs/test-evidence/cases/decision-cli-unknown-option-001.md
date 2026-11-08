### Case DECISION-CLI-UNKNOWN-OPTION-001: CLI 拒绝未知选项

Tests:
- `test:6e47f8cda3c29049a6d3c915454f4c20fe67bb4cc28b7a38cdd5d44d6ef55fe9`

Tags:
- `decision-records`

Contract:
- 各子命令必须在参数边界拒绝未声明选项并使用参数错误退出码。

Proves:
- 真实两域 CLI 的 list 与 new 收到未知选项均退出 2，stdout 恰为一个含 `invalid-arguments` 的 JSON 对象；节点以查询和 mutation 为代表，不枚举所有命令。
