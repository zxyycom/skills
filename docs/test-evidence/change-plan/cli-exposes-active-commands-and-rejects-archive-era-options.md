### Case CHANGE-PLAN-CLI-001: CLI 只公开 active complete 命令面
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI exposes active commands and rejects archive-era options`
- `bun test --test-name-pattern="^CLI exposes active commands and rejects archive-era options$" ./tools/change-plan/tests/run.ts`
Contract:
- Change Plan 的公开命令面是 `list`、`show`、`check`、`check-all`、`plan` 与 `complete`；archive 命令及 `--archived`、`--all` 已移除。
Proves:
- 帮助文本列出 complete，不含 archive-era surface。
- 将 `--archived` 传给 list 以参数错误退出。
