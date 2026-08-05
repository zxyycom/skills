### Case CHECK-FAILURE-CONTINUE-001: 前置失败不阻塞其余检查
Entry:
- `scripts/check.test.ts > preflight scheduling continues after failures`
- `bun test --test-name-pattern="^preflight scheduling continues after failures$" ./scripts/check.test.ts`
Contract:
- 单个前置任务失败必须被保留为最终失败信号，但不能阻止其他已选择任务继续执行。
Proves:
- 失败后的后续任务仍被领取并完成。
- 前置结果同时保留 failed 与 passed 状态，并报告存在失败。
