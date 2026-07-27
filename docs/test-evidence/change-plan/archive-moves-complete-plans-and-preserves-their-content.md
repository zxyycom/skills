### Case CHANGE-PLAN-ARCHIVE-MOVE-001: 完整计划被原子归档
Entry:
- `tools/change-plan/tests/archive.test.ts > archive moves complete plans and preserves their content`
- `bun test --test-name-pattern="^archive moves complete plans and preserves their content$" ./tools/change-plan/tests/run.ts`
Contract:
- 完整计划归档后必须从活动目录移动到归档目录并保持内容。
Proves:
- 源目录消失、目标目录存在，三个计划制品内容保持不变。
