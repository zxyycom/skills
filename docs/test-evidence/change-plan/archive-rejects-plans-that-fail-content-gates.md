### Case CHANGE-PLAN-ARCHIVE-GATES-001: 归档拒绝未通过内容门禁的计划
Entry:
- `tools/change-plan/tests/archive.test.ts > archive rejects plans that fail content gates`
- `bun test --test-name-pattern="^archive rejects plans that fail content gates$" ./tools/change-plan/tests/run.ts`
Contract:
- Change 只有处于 implementation 阶段，且 proposal、design 和 tasks 满足内容门禁后才能归档。
Proves:
- 未完成的 implementation Change 与任务已完成的 draft Change 都保持在活动目录并返回对应阻断原因。
