### Case CHANGE-PLAN-LIFECYCLE-PLAN-001: Plan 支持确认 Draft 与重确认已有进度的 Plan

Tests:
- `test:f9cd4e279fd9a8fe28a2940050cfb38fbd011bd029e7a021b0e25bad454b4dc6`

Tags:
- `change-plan`

Contract:
- `plan` 以完整 Plan artifacts 和当前 Git HEAD 确认内容状态，tasks 中的 checkbox 继续只表达 Plan 内进度。

Proves:
- Draft 确认后的 Plan metadata 基线等于独立读取的 Git HEAD，tasks 原始字节不变。
- Readiness 尚未完成且 Implementation、Verification 已有完成证据的 Plan 仍可重确认；基线等于当时 Git HEAD，tasks 原始字节不变。
