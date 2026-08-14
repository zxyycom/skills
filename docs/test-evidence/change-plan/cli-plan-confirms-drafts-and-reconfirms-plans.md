### Case CHANGE-PLAN-CLI-PLAN-CANONICAL-INPUTS-001: Plan CLI 确认规范 Draft 与 Plan
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI plan confirms drafts and reconfirms plans`
- `bun test --test-name-pattern="^CLI plan confirms drafts and reconfirms plans$" ./tools/change-plan/tests/run.ts`

Contract:
- `plan` 接受规范 Draft 与现有规范 Plan，并统一写入调用时的当前 Git 基线；checkbox 进度不构成确认门禁。

Proves:
- Draft 即使 Readiness 未完成且后续区段已有证据也能确认，现有 Plan 也能重确认。
- 每个成功结果的 metadata 恰好包含 `stage: plan` 与当前 `baseCommit`。
