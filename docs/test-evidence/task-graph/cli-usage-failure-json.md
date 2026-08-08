### Case TASK-GRAPH-CLI-USAGE-001: Usage failure 使用 JSON 协议

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI usage failures use the JSON protocol`
- `bun test --test-name-pattern="^CLI usage failures use the JSON protocol$" ./tools/task-graph/tests/run.ts`

Contract:
- 非 task-list command 的缺参 usage failure 保持全局 JSON error envelope。

Proves:
- 缺少 task create 必需参数时退出 1，返回 revision null 的 ARGUMENT_INVALID JSON。
