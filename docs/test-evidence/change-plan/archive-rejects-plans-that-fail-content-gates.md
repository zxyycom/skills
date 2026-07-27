### Case CHANGE-PLAN-ARCHIVE-GATES-001: 归档拒绝未通过内容门禁的计划
Entry:
- `tools/change-plan/tests/archive.test.ts > archive rejects plans that fail content gates`
- `bun test --test-name-pattern="^archive rejects plans that fail content gates$" ./tools/change-plan/tests/run.ts`
Contract:
- Change plan 只有在 proposal、design 和 tasks 满足归档门禁后才能归档。
Proves:
- 未完成或无效计划保持在活动目录并返回阻断诊断。
