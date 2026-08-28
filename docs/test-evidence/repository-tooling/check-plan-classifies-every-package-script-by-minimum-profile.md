### Case CHECK-PLAN-SCRIPTS-001: 检查计划声明每个脚本的最低档位
Entry:
- `scripts/check.test.ts > check plan classifies every package script by minimum profile`
- `bun test --test-name-pattern="^check plan classifies every package script by minimum profile$" ./scripts/check.test.ts`
Contract:
- 检查计划必须显式列出全部门禁 package script，并为每个前置任务声明最低运行档位。
Proves:
- `checkPreflightTasks` 返回预期的任务名称和最低档位，`checkPackageScripts` 在其后加入 `pack:skills`。
- `test:relation-graph` 的最低档位是 `quick`，quick 任务在 quick 与 full 档都被选择。
- `lint` 与 `format:check` 作为 quick 前置任务同时进入 quick 和 full 门禁。
- quick 任务在 quick 与 full 档运行，full 任务只在 full 档运行。
