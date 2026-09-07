### Case REPO-TASK-TARGET-001: task-graph 短命令拒绝无效的显式项目 root

Tests:
- `test:12d68c0a0603b114bb2ac56e768c12fdeec4665e9f6b4dddc950942c7f57f719`

Tags:
- `repository-tooling`

Contract:
- 仓库 task-graph package 命令接受显式项目 root 前必须确认目标同时拥有 canonical index 入口和项目自己的 task-graph CLI。

Proves:
- 显式 root 指向不存在的项目时，launcher 在子进程启动前报告目标缺少 task index。
- 显式 root 只有 task index 但缺少 CLI 时，launcher 在子进程启动前报告目标缺少 task-graph CLI。
