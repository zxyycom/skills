### Case CHANGE-PLAN-LIFECYCLE-VC-001: Plan 缺少 HEAD 时不写 metadata

Tests:
- `test:09aea1ef1061a6a9c0224b8d747f8f9af8454cdd4019ce04063afd41a02d71b7`

Tags:
- `change-plan`

Contract:
- `plan` 从当前仓库 HEAD 记录基线；仓库尚无 HEAD 时保持现有 Draft metadata。

Proves:
- 无 HEAD 时返回 `base-commit-unavailable` 与 `action: plan`。
- 命令前后的 Draft metadata 字节保持一致。
