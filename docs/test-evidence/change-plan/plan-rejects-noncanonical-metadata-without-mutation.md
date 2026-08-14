### Case CHANGE-PLAN-LIFECYCLE-STRICT-METADATA-001: Plan 拒绝非规范 metadata 且不改写目标
Entry:
- `tools/change-plan/tests/lifecycle.test.ts > plan rejects noncanonical metadata without mutation`
- `bun test --test-name-pattern="^plan rejects noncanonical metadata without mutation$" ./tools/change-plan/tests/run.ts`

Contract:
- `plan` 只接受规范 Draft 或 Plan；无效 active metadata 使用既有失败通道，不提供自动迁移或隐藏写回。

Proves:
- `implementation`、`shelved` 与 null-base Plan 都返回 `invalid-source-stage`，并携带 `invalid-metadata` 诊断。
- 每个失败目标的 `.change-plan.json` 字节保持不变。
