### Case CHANGE-PLAN-CATALOG-INVALID-001: 无效计划仍可被发现
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog keeps invalid change entries discoverable`
- `bun test --test-name-pattern="^catalog keeps invalid change entries discoverable$" ./tools/change-plan/tests/run.ts`
Contract:
- 结构或内容无效的 change 不得从目录查询中静默消失。
Proves:
- 无效条目仍返回身份和诊断，便于定位修复。
