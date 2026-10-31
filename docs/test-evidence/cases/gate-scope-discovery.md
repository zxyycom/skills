### Case GATE-SCOPE-DISCOVERY-001: 能力发现不启动 Gate

Tests:
- `test:0f73dbbf34972dc50b55f20c4ae93fcad074cec5b0b004176f51747268512ac5`

Tags:
- `repository-tooling`

Contract:
- --list-scopes 仅发现可选能力组，不受 CI 全量策略变成 Gate 执行。

Proves:
- CI 环境下发现命令退出 0，输出包含 gate-tests、task-graph、decision-stage 与 mcpshell；不创建 Definition、目录，不准备或运行 Gate，也不输出错误。
