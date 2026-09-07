### Case INDEX-RUNTIME-RUNTIME-001: 通过直接操作查询并获取运行时状态

Tests:
- `test:794b9518ed16dc88ddfd1744f950d9a390b002b12369b4143bc537378fd2e033`

Tags:
- `index-runtime`

Contract:
- Runtime 直接 `query` 与 `get` 必须加载当前索引，并允许按 ID record 提供调用级状态覆盖。

Proves:
- 直接过滤、标识获取和归档状态覆盖均返回预期结果。
