### Case CHECK-PLAN-SCRIPTS-001: 检查计划声明每个脚本的最低档位
Entry:
- `scripts/check.test.ts > check plan classifies every package script by minimum profile`
- `bun test --test-name-pattern="^check plan classifies every package script by minimum profile$" ./scripts/check.test.ts`
Contract:
- 检查计划必须显式列出全部 package script，并为每个前置任务声明最低运行档位。
Proves:
- 实际任务名称、最低档位和打包入口与仓库声明完全一致。
- quick 任务在 quick 与 full 档运行，full 任务只在 full 档运行。
