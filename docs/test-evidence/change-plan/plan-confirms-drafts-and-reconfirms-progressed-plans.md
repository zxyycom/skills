### Case CHANGE-PLAN-LIFECYCLE-PLAN-001: Plan 支持确认 Draft 与重确认已有进度的 Plan
Entry:
- `tools/change-plan/tests/lifecycle.test.ts > plan confirms drafts and reconfirms plans without task progress gates`
- `bun test --test-name-pattern="^plan confirms drafts and reconfirms plans without task progress gates$" ./tools/change-plan/tests/run.ts`

Contract:
- `plan` 以完整 Plan artifacts 和当前 Git HEAD 确认内容状态，tasks 中的 checkbox 继续只表达 Plan 内进度。

Proves:
- Draft 成功确认成带非空基线的 Plan。
- Readiness 尚未完成且 Implementation、Verification 已有完成证据的 Plan 仍成功重确认成 Plan。
