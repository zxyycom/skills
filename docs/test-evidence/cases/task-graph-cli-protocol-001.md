### Case TASK-GRAPH-CLI-PROTOCOL-001: Root help 暴露命令目录、runtime 前置与全局 JSON option

Tests:
- `test:e0ecd5fd95bf9bd11d39b517732343b7f6b9209c24f49b261cdf120e2fe5b7cd`

Tags:
- `task-graph`

Contract:
- Root help 通过单个 LF 结尾 JSON 返回规范命令目录、runtime requirements 和默认 false 的全局 --json boolean option；根目录本身不代表具体命令，因此 `requiresMutationRuntime` 为 null。

Proves:
- Root help 的 revision 为 null、usage 以 task-graph 开头，24 个命令中包含 index stage。
- Runtime 支持范围、setup/install 来源与 --json 参数结构逐字段可恢复。
