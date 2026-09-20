### Case CHANGE-PLAN-CLI-001: CLI 只公开 active finalize 命令面

Tests:
- `test:491993076f96085dd74d3770adf2730af4610920832dc455e5eb805a8941faeb`

Tags:
- `change-plan`

Contract:
- Change Plan 的公开命令面是 `list`、`show`、`check`、`check-all`、`plan` 与 `finalize`；传入 `complete`、`archive`、`--archived` 或 `--all` 均为参数错误。

Proves:
- 帮助文本列出 finalize，不含 `complete`、`archive` 或 `--archived`、`--all`。
- 将 `complete`、`archive` 和 `--archived` 传入 CLI 均以参数错误退出。
