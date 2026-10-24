### Case TASK-GRAPH-CLI-PATH-001: 路径失败映射 JSON 退出码一

Tests:
- `test:4ffa68ba8f380643a83d7ae522ef98b9966104f0ad9c3e4eb153868e38a71747`

Tags:
- `task-graph`

Contract:
- 源码 CLI 入口中的路径读取失败仍属于协议内错误，不泄漏原始异常到 stderr 或启动级退出码。

Proves:
- callRawCli 的路径失败返回预期 JSON 错误与 exitCode=1；观察范围为 callRawCli 返回结果。
