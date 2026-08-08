### Case INDEX-RUNTIME-RUNTIME-001: 通过直接操作查询并获取运行时状态
Entry:
- `tools/index-runtime/tests/runtime.test.ts > queries and gets runtime states through direct operations`
- `bun test --test-name-pattern="^queries and gets runtime states through direct operations$" ./tools/index-runtime/tests/run.ts`
Contract:
- Runtime 直接 `query` 与 `get` 必须加载当前索引，并允许按 ID record 提供调用级状态覆盖。
Proves:
- 直接过滤、标识获取和归档状态覆盖均返回预期结果。
