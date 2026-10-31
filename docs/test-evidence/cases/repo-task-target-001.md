### Case REPO-TASK-TARGET-001: task-graph 短命令拒绝无效的显式项目 root

Tests:
- `test:2d7488640dde73fa62666080b002efb70c4a56c6c4401a010b42f5c441e7906b`

Tags:
- `repository-tooling`

Contract:
- 仓库 task-graph package 命令接受显式项目 root 前必须确认目标同时拥有 canonical index 入口和项目自己的 `task-graph.ts` CLI。

Proves:
- 显式 root 指向不存在的项目时，launcher 在子进程启动前报告目标缺少 task index。
- 显式 root 只有 task index 但缺少 CLI 时，launcher 在子进程启动前报告目标缺少 task-graph CLI。
