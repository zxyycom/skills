### Case CHANGE-PLAN-CLI-CHECK-ALL-ROOTS-001: Check-all CLI 报告生命周期根目录诊断
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI check-all reports lifecycle root diagnostics`
- `bun test --test-name-pattern="^CLI check-all reports lifecycle root diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- `check-all` 遇到不可用 change root 时必须在文本和 JSON 模式中报告根级失败，并使用相同失败退出状态。
Proves:
- JSON stdout 保留根级错误且退出 `1`；文本模式保持 stdout 为空，并把失败摘要和可行动诊断写入 stderr。
