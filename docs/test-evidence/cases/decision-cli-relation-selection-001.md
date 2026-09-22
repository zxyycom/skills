### Case DECISION-CLI-RELATION-SELECTION-001: 被移除的 activate 命令与覆盖选项走普通无效输入

Tests:
- `test:d374cb87ae9ff431cb5c1a7fae2d3486071665329732271ad4ff2299f77f3c89`

Tags:
- `decision-records`

Contract:
- 被 `publish` 取代的 `activate` 命令与其关系覆盖选项不保留兼容别名、弃用分支或迁移提示，只按普通未知命令或未知选项处理。

Proves:
- `activate` 调用退出 2 并报告 unknown command。
- publish 上的 `--relation`、`--relation-summary` 与 `--clear-relations` 均退出 2 并报告 unknown option，stdout 保持为空。
