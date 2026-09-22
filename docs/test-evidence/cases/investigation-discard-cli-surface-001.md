### Case INVESTIGATION-DISCARD-CLI-SURFACE-001: 单一 discard 动作与被移除的目标专属参数

Tests:
- `test:caf8ccbce7c8bdc056b8398d4fb0607121a390d3acbabdfa83e2cc38471f5322`

Tags:
- `investigation-report`

Contract:
- 公开 help 只呈现统一 `discard`、`--delete-recorded` 与 `--delete-owned-resources`；被取代的 `discard-candidate` 命令和目标专属删除确认参数只按普通无效输入处理。

Proves:
- `discard --help` 展示统一确认参数，不再出现 `--delete-recorded-report` 与 `--delete-recorded-candidate`。
- `discard-candidate` 是未知命令；两个旧确认参数在 discard 上退出 2 并报告 unknown option。
