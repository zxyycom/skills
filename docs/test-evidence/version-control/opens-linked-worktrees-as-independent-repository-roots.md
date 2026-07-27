### Case VERSION-CONTROL-WORKTREE-001: 将 linked worktree 作为独立仓库根打开
Entry:
- `tools/shared/tests/version-control.test.ts > opens linked worktrees as independent repository roots`
- `bun test --test-name-pattern="^opens linked worktrees as independent repository roots$" ./tools/shared/tests/version-control.test.ts`
Contract:
- linked worktree 必须以自身工作树目录为仓库根，同时共享可读修订对象。
Proves:
- 从嵌套目录打开后根路径、当前修订和修订文件读取均指向 linked worktree。
