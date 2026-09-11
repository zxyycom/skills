### Case INDEX-RUNTIME-RUNTIME-001: 通过直接操作查询并获取运行时状态

Tests:
- `test:ac5c8519d6b86fa42e2b17e148806b85a77e0a657e36c7738f9f2be45842b2e5`

Tags:
- `index-runtime`

Contract:
- Runtime 直接 `query` 与 `get` 必须加载当前索引，并允许按 ID record 提供调用级状态覆盖。

Proves:
- 直接过滤、标识获取和归档状态覆盖均返回预期结果。
