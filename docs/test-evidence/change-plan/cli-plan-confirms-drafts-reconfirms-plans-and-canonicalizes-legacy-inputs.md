### Case CHANGE-PLAN-CLI-PLAN-INPUTS-001: Plan CLI 确认并规范化活动输入
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI plan confirms drafts, reconfirms plans, and canonicalizes legacy inputs`
- `bun test --test-name-pattern="^CLI plan confirms drafts, reconfirms plans, and canonicalizes legacy inputs$" ./tools/change-plan/tests/run.ts`

Contract:
- `plan` 接受 Draft、现有 Plan 与兼容读取支持的历史活动 metadata，并统一写回规范 Plan。

Proves:
- Draft 即使 Readiness 未完成且后续区段已有证据也能确认。
- 规范 Plan、历史 `implementation`、历史 `shelved` 与 null-base Plan 都能重确认。
- 每个成功结果的 metadata 恰好包含 `stage: plan` 与当前 `baseCommit`。
