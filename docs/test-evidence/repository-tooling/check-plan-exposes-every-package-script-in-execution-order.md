### Case CHECK-PLAN-SCRIPTS-001: 完整检查计划保持稳定脚本顺序
Entry:
- `scripts/check.test.ts > check plan exposes every package script in execution order`
- `bun test --test-name-pattern="^check plan exposes every package script in execution order$" ./scripts/check.test.ts`
Contract:
- 完整检查计划必须显式列出全部 package script，并保持约定的执行顺序。
Proves:
- 实际前置任务名称和命令与仓库声明的稳定顺序完全一致。
