### Case MCPSHELL-BRIDGE-DIST-001: 分发模块无需配置即可无可观察副作用地导入

Tests:
- `test:9961bd4e324712dbfce4b027343b76002ab28402b67c45be8fc8173e0743b556`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 分发 `.ts` 在没有环境配置时可被 Node import，不执行 CLI 或改写配置。

Proves:
- initializer 与 runtime module 在空环境、隔离目录的独立 Node import 进程中均以 status 0 结束，stdout/stderr 为空；agent project 路径集合、ignore 与 definitions 原始字节保持不变。
