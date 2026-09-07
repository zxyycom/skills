### Case CHANGE-PLAN-LIFECYCLE-PLAN-001: Plan 支持确认 Draft 与重确认已有进度的 Plan

Tests:
- `test:794cc065515f7d44a20a0e8d9f070f053e894218d1c161f37eca21f0acc7a62f`

Tags:
- `change-plan`

Contract:
- `plan` 以完整 Plan artifacts 和当前 Git HEAD 确认内容状态，tasks 中的 checkbox 继续只表达 Plan 内进度。

Proves:
- Draft 成功确认成带非空基线的 Plan。
- Readiness 尚未完成且 Implementation、Verification 已有完成证据的 Plan 仍成功重确认成 Plan。
