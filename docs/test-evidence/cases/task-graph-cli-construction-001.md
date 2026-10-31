### Case TASK-GRAPH-CLI-CONSTRUCTION-001: Service 构造 failure 保持全局 JSON 协议

Tests:
- `test:410d90d98ce5a263a9abe2f94b19e9fba9afdfc52a064d3131b5d050e5d82c70`

Tags:
- `task-graph`

Contract:
- TaskGraphService 尚未成功构造时不存在可执行 task-list route，失败必须使用 revision-null JSON。

Proves:
- 越出 root 的 index path 返回 revision null 的 ARGUMENT_INVALID，并逐字节等于单 LF JSON serialization。
