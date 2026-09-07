### Case CHANGE-PLAN-LIFECYCLE-VC-001: Plan 缺少 HEAD 时不写 metadata

Tests:
- `test:d0a54b132f0bc4e955030f53baa67e58fa0e44292a7fcf3c9320c75dbe75d7c8`

Tags:
- `change-plan`

Contract:
- `plan` 从当前仓库 HEAD 记录基线；仓库尚无 HEAD 时保持现有 Draft metadata。

Proves:
- 无 HEAD 时返回 `base-commit-unavailable` 与 `action: plan`。
- 命令前后的 Draft metadata 字节保持一致。
