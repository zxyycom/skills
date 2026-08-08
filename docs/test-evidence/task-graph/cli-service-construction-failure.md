### Case TASK-GRAPH-CLI-CONSTRUCTION-001: Service 构造 failure 保持全局 JSON 协议

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI service-construction failures stay on the global JSON protocol`
- `bun test --test-name-pattern="^CLI service-construction failures stay on the global JSON protocol$" ./tools/task-graph/tests/run.ts`

Contract:
- TaskGraphService 尚未成功构造时不存在可执行 task-list route，失败必须使用 revision-null JSON。

Proves:
- 越出 root 的 index path 返回 revision null 的 ARGUMENT_INVALID，并逐字节等于单 LF JSON serialization。
