### Case TASK-GRAPH-CLI-PATH-001: 路径失败映射 JSON 退出码一

Tests:
- `test:4c6bc675b4b7256148202a62f730ebe6fa83361bcaee5281fa32fd735d14deed`

Tags:
- `task-graph`

Contract:
- 源码 CLI 入口中的路径读取失败仍属于协议内错误，不泄漏原始异常到 stderr 或启动级退出码。

Proves:
- callRawCli 的路径失败返回预期 JSON 错误与 exitCode=1；观察范围为 callRawCli 返回结果。
