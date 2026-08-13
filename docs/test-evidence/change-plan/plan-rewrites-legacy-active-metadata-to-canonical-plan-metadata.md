### Case CHANGE-PLAN-LIFECYCLE-LEGACY-001: Plan 将旧活动 metadata 写回规范结构
Entry:
- `tools/change-plan/tests/lifecycle.test.ts > plan rewrites legacy active metadata to canonical plan metadata`
- `bun test --test-name-pattern="^plan rewrites legacy active metadata to canonical plan metadata$" ./tools/change-plan/tests/run.ts`

Contract:
- 兼容读取让历史活动 metadata 在显式运行 `plan` 时收敛为规范 Plan，写入结果统一使用当前结构。

Proves:
- 历史 `implementation`、历史 `shelved` 与 null-base Plan 都以 Plan 身份完成重确认。
- 重确认后的持久 JSON 恰好包含 `stage: plan` 与非空 `baseCommit`。
