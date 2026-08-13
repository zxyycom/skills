### Case CHANGE-PLAN-CLI-COMMANDS-001: CLI 公开固定六命令表面
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI exposes only six commands and rejects removed lifecycle commands`
- `bun test --test-name-pattern="^CLI exposes only six commands and rejects removed lifecycle commands$" ./tools/change-plan/tests/run.ts`

Contract:
- Change Plan CLI 的完整命令集合是 `list`、`show`、`check`、`check-all`、`plan` 与 `archive`，stage 参数的合法值集合是 `draft` 与 `plan`。

Proves:
- Help 列出完整六命令集合且 stderr 为空。
- 测试覆盖的四个命令集合外名称均以未知命令和退出码 `2` 反馈。
- `list --stage` 对合法集合外的值返回参数错误。
