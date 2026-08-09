### Case REPO-TASK-ROOT-001: task-graph 短命令默认中央 root 并允许显式切换项目
Entry:
- `scripts/environment.test.ts > task-graph package command defaults to the main root and accepts an explicit project root`
- `bun test --test-name-pattern="^task-graph package command defaults to the main root and accepts an explicit project root$" ./scripts/environment.test.ts`
Contract:
- 仓库 task-graph package 命令默认从 Git 结构发现当前项目中央 root；唯一显式 root 则切换到目标项目自己的 CLI 和 canonical index。
Proves:
- linked worktree 中省略 root 时，package 命令实际从主 worktree 运行中央 CLI，并向其传入同一个绝对 `--root`。
- 绝对 `--root <path>` 与相对 `--root=<path>` 都会切换到目标项目，并从目标项目运行其 CLI。
- 即使进程从 worktree 子目录直接调用 launcher，相对 root 仍以 launcher 所在 worktree 为基准。
- 缺值、重复 root 或任何 `--index` 时，launcher 在调用领域 CLI 前失败。
