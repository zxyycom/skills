### Case CHANGE-PLAN-CLI-SHOW-ARCHIVED-001: Show CLI 读取 Archived Artifact 且不返回检查结果
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI show reads archived artifacts without a check result`
- `bun test --test-name-pattern="^CLI show reads archived artifacts without a check result$" ./tools/change-plan/tests/run.ts`
Contract:
- Show CLI 可以读取 archived Change 的原始 artifacts，但不恢复 stage、任务进度或有效性判断。
Proves:
- 当前结构无效且缺少 design/tasks 的 archived Change 仍成功显示历史 proposal 与 `Check: not applicable (archived)`。
- Archived JSON 返回 `status: archived`、`check: null` 与空 errors，文本不显示 Stage、Tasks 或 valid/invalid。
