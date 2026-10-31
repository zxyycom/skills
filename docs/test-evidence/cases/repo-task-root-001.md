### Case REPO-TASK-ROOT-001: task-graph 短命令默认中央 root 并允许显式切换项目

Tests:
- `test:01ed9d38f492cb50319daa65903a2d504a41c187c8f4407814abdade5ad69c3e`

Tags:
- `repository-tooling`

Contract:
- 仓库 task-graph package 命令默认从 Git 结构发现当前项目中央 root；唯一显式 root 则切换到目标项目自己的 TS CLI 和 canonical index。

Proves:
- linked worktree 中省略 root 时，package 命令实际从主 worktree 运行中央 CLI，并向其传入同一个绝对 `--root`。
- 绝对 `--root <path>` 与相对 `--root=<path>` 都会切换到目标项目，并从目标项目运行其 CLI。
- 即使进程从 worktree 子目录直接调用 launcher，相对 root 仍以 launcher 所在 worktree 为基准。
- 缺值、重复 root 或任何 `--index` 时，launcher 在调用领域 CLI 前失败。
