### Case ENV-WORKTREE-SETUP-001: linked worktree 重复 setup 保持当前项目中央 root

Tests:
- `test:f96e608ba58498a86d686e3c9d60d7ec2f468710b106bcc3f2674bf9fca77863`

Tags:
- `repository-tooling`

Contract:
- linked worktree 的标准环境 setup 必须可重复执行；当前项目默认 task root 必须能从 Git 结构稳定发现为同仓主 worktree，而不是写入或使用执行 worktree。

Proves:
- 连续两次 setup 都成功，Git worktree 列表的首个项目根保持主 worktree 绝对路径，无需额外 root 配置。
- 原本不可执行的 linked worktree pre-commit 在 setup 后会被真实 `git commit` 调用。
