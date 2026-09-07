### Case CHANGE-PLAN-CLI-001: CLI 只公开 active complete 命令面

Tests:
- `test:f396084efd8c8b0c866c47b95a0e5c8d46bbea5efca2711022e505a6fc68690e`

Tags:
- `change-plan`

Contract:
- Change Plan 的公开命令面是 `list`、`show`、`check`、`check-all`、`plan` 与 `complete`；archive 命令及 `--archived`、`--all` 已移除。

Proves:
- 帮助文本列出 complete，不含 archive-era surface。
- 将 `--archived` 传给 list 以参数错误退出。
