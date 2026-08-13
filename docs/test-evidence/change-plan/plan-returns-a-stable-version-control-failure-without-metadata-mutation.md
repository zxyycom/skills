### Case CHANGE-PLAN-LIFECYCLE-VC-001: Plan 缺少 HEAD 时不写 metadata
Entry:
- `tools/change-plan/tests/lifecycle.test.ts > plan returns a stable version-control failure without metadata mutation`
- `bun test --test-name-pattern="^plan returns a stable version-control failure without metadata mutation$" ./tools/change-plan/tests/run.ts`

Contract:
- `plan` 从当前仓库 HEAD 记录基线；仓库尚无 HEAD 时保持现有 Draft metadata。

Proves:
- 无 HEAD 时返回 `base-commit-unavailable` 与 `action: plan`。
- 命令前后的 Draft metadata 字节保持一致。
