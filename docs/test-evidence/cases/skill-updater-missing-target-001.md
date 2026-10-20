### Case SKILL-UPDATER-MISSING-TARGET-001: Updater 可安装到缺失目录

Tests:
- `test:ec13734eb726012e6dc26bf788037ee0d621e1d5111b56f1eb005f798959ddae`

Tags:
- `skill-updater`

Contract:
- 不存在的目标目录应被视为合法首次安装目标并由 updater 创建。

Proves:
- missing 状态成功安装完整远端 `SKILL.md`。
