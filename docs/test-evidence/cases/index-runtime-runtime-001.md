### Case INDEX-RUNTIME-RUNTIME-001: 通过直接操作查询并获取运行时状态

Tests:
- `test:6dc7956698eaf09abcfe5e14b6456ae3cdff953cd233b6ff0ec63d247a8464d6`

Tags:
- `index-runtime`

Contract:
- Runtime 直接 `query` 与 `get` 必须加载当前索引，并允许按 ID record 提供调用级状态覆盖。

Proves:
- 直接过滤、标识获取和归档状态覆盖均返回预期结果。
