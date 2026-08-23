### Case CHANGE-PLAN-CLI-CHECK-ARCHIVED-001: Check CLI 拒绝 Archived 且不报告 Artifact 诊断
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI check rejects archived changes without artifact diagnostics`
- `bun test --test-name-pattern="^CLI check rejects archived changes without artifact diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- Check CLI 只门禁 active Change；对 archived 路径只报告命令不适用。
Proves:
- 文本模式退出 `1` 并报告 `archived-change-not-checkable`，不报告缺失文件或 Markdown 结构问题。
- JSON 模式退出 `1`、保持 stderr 为空，并返回 `valid: false` 与零任务计数。
