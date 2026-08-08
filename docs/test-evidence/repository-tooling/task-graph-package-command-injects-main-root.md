### Case REPO-TASK-ROOT-001: task-graph 短命令注入已配置的中央 root
Entry:
- `scripts/environment.test.ts > task-graph package command requires and injects the configured main root`
- `bun test --test-name-pattern="^task-graph package command requires and injects the configured main root$" ./scripts/environment.test.ts`
Contract:
- 仓库 task-graph package 命令只向现有领域 CLI 注入已配置的中央协调 root 和唯一索引，不能按当前 worktree 静默猜测或接受第二个 root 或 index。
Proves:
- linked worktree 中的 package 命令实际从主 worktree 运行中央 CLI，并向其传入同一个绝对 `--root`。
- 调用方传入 `--root`、`--index` 或仓库没有 root 配置时，launcher 在调用领域 CLI 前失败。
