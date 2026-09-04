### Case CHANGE-PLAN-CLI-006: 单目录命令支持项目约定的自定义 Change 根
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI supports direct members of a custom Change root`
- `bun test --test-name-pattern="^CLI supports direct members of a custom Change root$" ./tools/change-plan/tests/run.ts`
Contract:
- 单目录命令从显式目标的父目录推导项目约定 Change 根；未约定时 CLI 默认根仍为 `changes/`，但不把该默认目录名硬编码为单目录目标的成员资格。
Proves:
- 自定义 Change 根中名为 `archive` 的普通直接 Plan member 可被 `check` 与 `show` 成功读取并通过 `complete --preflight`；直接 Draft member 可由 `plan` 写为 Plan。
