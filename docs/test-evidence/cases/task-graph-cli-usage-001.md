### Case TASK-GRAPH-CLI-USAGE-001: Usage failure 使用 JSON 协议

Tests:
- `test:3517e0a9ee6ce5ad036011de1a6fedf2edd88044bcaa8381f5469fb1326f1de0`

Tags:
- `task-graph`

Contract:
- 非 task-list command 的缺参 usage failure 保持全局 JSON error envelope。

Proves:
- 缺少 task create 必需参数时退出 1，返回 revision null 的 ARGUMENT_INVALID JSON。
- 12,000 个命令 token 不触发调用栈溢出，仍以退出 1 的 ARGUMENT_INVALID JSON envelope 返回。
