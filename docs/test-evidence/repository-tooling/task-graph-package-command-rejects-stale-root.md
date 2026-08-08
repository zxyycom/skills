### Case REPO-TASK-STALE-001: task-graph 短命令拒绝陈旧的中央 root
Entry:
- `scripts/environment.test.ts > task-graph package command rejects a stale configured main root`
- `bun test --test-name-pattern="^task-graph package command rejects a stale configured main root$" ./scripts/environment.test.ts`
Contract:
- 仓库 task-graph package 命令每次调用都必须确认已配置 root 仍是当前 Git 仓库的主 worktree，不能仅凭旧路径仍有 task index 就继续执行。
Proves:
- 将 `skills.taskGraphRoot` 指向另一个仍含合法 task index 的仓库时，launcher 在调用领域 CLI 前报告 main-worktree mismatch 并失败。
