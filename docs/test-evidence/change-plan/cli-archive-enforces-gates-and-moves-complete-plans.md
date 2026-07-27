### Case CHANGE-PLAN-CLI-ARCHIVE-001: Archive CLI 执行门禁与移动
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI archive enforces gates and moves complete plans`
- `bun test --test-name-pattern="^CLI archive enforces gates and moves complete plans$" ./tools/change-plan/tests/run.ts`
Contract:
- Archive CLI 必须复用归档门禁并只移动完整计划。
Proves:
- 无效计划被拒绝，完整计划被移动到归档生命周期。
