### Case CHECK-WARNING-SCHEDULING-001: 警告模式允许后续检查继续
Entry:
- `scripts/check.test.ts > warning scheduling continues after recoverable failures`
- `bun test --test-name-pattern="^warning scheduling continues after recoverable failures$" ./scripts/check.test.ts`
Contract:
- 可恢复失败在警告模式下不得中断其余检查任务。
Proves:
- 警告结果被保留，同时后续任务仍完成执行。
