### Case CHANGE-PLAN-CLI-001: CLI 只公开 active finalize 命令面

Tests:
- `test:458d80a7e2ba4214a5a1d813db8d1b7ae0673715fa998c3e6974e64b4a678903`

Tags:
- `change-plan`

Contract:
- Change Plan 的公开命令面是 `list`、`show`、`check`、`check-all`、`plan` 与 `finalize`；传入 `complete`、`archive`、`--archived` 或 `--all` 均为参数错误。

Proves:
- 帮助文本列出 finalize，不含 `complete`、`archive` 或 `--archived`、`--all`。
- 将 `complete`、`archive` 和 `--archived` 传入 CLI 均以参数错误退出。
