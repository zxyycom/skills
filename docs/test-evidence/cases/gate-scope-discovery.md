### Case GATE-SCOPE-DISCOVERY-001: 能力发现不启动 Gate

Tests:
- `test:6dad05d98036f0823267457890ec83e290470789fa0b81bec65a77538649f8a7`

Tags:
- `repository-tooling`

Contract:
- --list-scopes 仅发现可选能力组，不受 CI 全量策略变成 Gate 执行。

Proves:
- CI 环境下发现命令退出 0，输出包含 gate-tests、task-graph、decision-stage 与 mcpshell；不创建 Definition、目录，不准备或运行 Gate，也不输出错误。
