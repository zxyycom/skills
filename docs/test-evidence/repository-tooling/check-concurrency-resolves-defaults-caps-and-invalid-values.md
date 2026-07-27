### Case CHECK-OPTIONS-MODES-001: 检查并发度具有严格解析契约
Entry:
- `scripts/check.test.ts > check concurrency resolves defaults, caps, and invalid values`
- `bun test --test-name-pattern="^check concurrency resolves defaults, caps, and invalid values$" ./scripts/check.test.ts`
Contract:
- 并发度必须采用安全默认值、受任务数约束，并拒绝非正整数。
Proves:
- 默认值、系统并行度和显式上限会生成有效并发度，非法值会在执行前被拒绝。
