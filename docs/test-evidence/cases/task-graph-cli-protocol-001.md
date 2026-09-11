### Case TASK-GRAPH-CLI-PROTOCOL-001: Root help 暴露命令目录、runtime 前置与全局 JSON option

Tests:
- `test:e55a22ce5f46c5cf0b4cfb32b5e57572c68691c92da8bbf96b9b6b7605d3f080`

Tags:
- `task-graph`

Contract:
- Root help 通过单个 LF 结尾 JSON 返回规范命令目录、runtime requirements 和默认 false 的全局 --json boolean option；根目录本身不代表具体命令，因此 `requiresMutationRuntime` 为 null。

Proves:
- Root help 的 revision 为 null、usage 以 task-graph 开头，24 个命令中包含 index stage。
- Runtime 支持范围、setup/install 来源与 --json 参数结构逐字段可恢复。
