### Case CHECK-WORKFLOW-PACKAGING-001: 前置失败后显式跳过打包
Entry:
- `scripts/check.test.ts > workflow skips packaging after preflight failures`
- `bun test --test-name-pattern="^workflow skips packaging after preflight failures$" ./scripts/check.test.ts`
Contract:
- 任一前置任务失败时，其余前置任务继续执行，但打包必须显式跳过并令工作流失败。
Proves:
- 失败后的前置任务仍然执行。
- 打包没有执行，结果包含 failed、passed 和 package skipped。
