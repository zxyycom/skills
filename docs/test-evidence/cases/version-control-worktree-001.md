### Case VERSION-CONTROL-WORKTREE-001: 将 linked worktree 作为独立仓库根打开

Tests:
- `test:c17de1661d0aaf3b82d81d1f2a4201b1cf51b6d5232d3eacf9a3cd78c794f09e`

Tags:
- `version-control`

Contract:
- linked worktree 必须以自身工作树目录为仓库根，同时共享可读修订对象。

Proves:
- 从嵌套目录打开后根路径、当前修订和修订文件读取均指向 linked worktree。
