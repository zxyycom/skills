### Case CHECK-STRICT-SCHEDULING-001: 严格模式在阻断失败后停止派发
Entry:
- `scripts/check.test.ts > strict scheduling stops new work and waits for running tasks`
- `bun test --test-name-pattern="^strict scheduling stops new work and waits for running tasks$" ./scripts/check.test.ts`
Contract:
- 严格模式遇到阻断失败后不得启动新任务，但必须等待已运行任务收尾。
Proves:
- 阻断失败后的待执行任务未被派发，已经启动的任务仍被完整回收。
