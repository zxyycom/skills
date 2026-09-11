### Case TASK-GRAPH-CLI-CONSTRUCTION-001: Service 构造 failure 保持全局 JSON 协议

Tests:
- `test:0f714370a684f2b35e122f30da0d92752201aa38c77a4126ff00259c2c367a1e`

Tags:
- `task-graph`

Contract:
- TaskGraphService 尚未成功构造时不存在可执行 task-list route，失败必须使用 revision-null JSON。

Proves:
- 越出 root 的 index path 返回 revision null 的 ARGUMENT_INVALID，并逐字节等于单 LF JSON serialization。
