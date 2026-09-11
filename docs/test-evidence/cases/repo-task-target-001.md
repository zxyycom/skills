### Case REPO-TASK-TARGET-001: task-graph 短命令拒绝无效的显式项目 root

Tests:
- `test:3f983281b0ad54b2fba0e221acfd41a72354219a80f7ee5f21af3e7da64ed2e4`

Tags:
- `repository-tooling`

Contract:
- 仓库 task-graph package 命令接受显式项目 root 前必须确认目标同时拥有 canonical index 入口和项目自己的 task-graph CLI。

Proves:
- 显式 root 指向不存在的项目时，launcher 在子进程启动前报告目标缺少 task index。
- 显式 root 只有 task index 但缺少 CLI 时，launcher 在子进程启动前报告目标缺少 task-graph CLI。
