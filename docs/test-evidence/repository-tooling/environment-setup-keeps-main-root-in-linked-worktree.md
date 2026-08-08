### Case ENV-WORKTREE-SETUP-001: linked worktree 重复 setup 保持中央 task root
Entry:
- `scripts/environment.test.ts > environment setup is idempotent in a linked worktree and keeps the main task root`
- `bun test --test-name-pattern="^environment setup is idempotent in a linked worktree and keeps the main task root$" ./scripts/environment.test.ts`
Contract:
- linked worktree 的标准环境 setup 必须可重复执行，并把 task-graph 协调 root 固定为同仓主 worktree，而不是执行 worktree。
Proves:
- 连续两次 setup 都成功，仓库 local config 中的 `skills.taskGraphRoot` 保持主 worktree 绝对路径。
- 原本不可执行的 linked worktree pre-commit 在 setup 后会被真实 `git commit` 调用。
