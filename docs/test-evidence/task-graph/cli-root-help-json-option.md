### Case TASK-GRAPH-CLI-PROTOCOL-001: Root help 暴露命令目录、runtime 前置与全局 JSON option

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI root help exposes commands runtime requirements and the global JSON option`
- `bun test --test-name-pattern="^CLI root help exposes commands runtime requirements and the global JSON option$" ./tools/task-graph/tests/run.ts`

Contract:
- Root help 通过单个 LF 结尾 JSON 返回规范命令目录、runtime requirements 和默认 false 的全局 --json boolean option。

Proves:
- Root help 的 revision 为 null、usage 以 task-graph 开头且命令数为 23。
- Runtime 支持范围、setup/install 来源与 --json 参数结构逐字段可恢复。
