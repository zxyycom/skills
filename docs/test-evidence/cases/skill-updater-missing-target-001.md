### Case SKILL-UPDATER-MISSING-TARGET-001: Updater 可安装到缺失目录

Tests:
- `test:476914cc0b2f59c15f5d39d5c2f039d2694e3724c2ead91c097751946e286b1a`

Tags:
- `skill-updater`

Contract:
- 不存在的目标目录应被视为合法首次安装目标并由 updater 创建。

Proves:
- missing 状态成功安装完整远端 `SKILL.md`。
