### Case CHECK-CLI-CONCURRENCY-001: CLI 在无效并发度下不启动检查
Entry:
- `scripts/check.test.ts > CLI reports invalid concurrency without starting checks`
- `bun test --test-name-pattern="^CLI reports invalid concurrency without starting checks$" ./scripts/check.test.ts`
Contract:
- CLI 必须在任务启动前验证并发度参数。
Proves:
- 无效并发度产生参数错误，且没有检查任务被执行。
