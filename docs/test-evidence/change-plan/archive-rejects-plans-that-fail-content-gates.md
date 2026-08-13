### Case CHANGE-PLAN-ARCHIVE-GATES-001: 归档拒绝未通过内容门禁的计划
Entry:
- `tools/change-plan/tests/archive.test.ts > archive rejects plans that fail content gates`
- `bun test --test-name-pattern="^archive rejects plans that fail content gates$" ./tools/change-plan/tests/run.ts`
Contract:
- 归档只接受结构检查有效、处于 active Plan 且全部 tasks 已完成的 Change。
Proves:
- 未完成的 Plan 与任务已完成的 Draft 都保持在活动目录并返回对应阻断原因。
