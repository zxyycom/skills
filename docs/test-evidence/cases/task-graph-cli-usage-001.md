### Case TASK-GRAPH-CLI-USAGE-001: Usage failure 使用 JSON 协议

Tests:
- `test:ac21c226f17b692304df8a52cc466373a563d14b4ba4ee37eacf175517812dc6`

Tags:
- `task-graph`

Contract:
- 非 task-list command 的缺参 usage failure 保持全局 JSON error envelope。

Proves:
- 缺少 task create 必需参数时退出 1，返回 revision null 的 ARGUMENT_INVALID JSON。
