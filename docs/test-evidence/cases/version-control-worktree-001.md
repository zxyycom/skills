### Case VERSION-CONTROL-WORKTREE-001: 将 linked worktree 作为独立仓库根打开

Tests:
- `test:cd740d07c990ef592f3a8095361025467fba24de2e3d707ae52b8d5b3373641c`

Tags:
- `version-control`

Contract:
- linked worktree 必须以自身工作树目录为仓库根，同时共享可读修订对象。

Proves:
- 从嵌套目录打开后根路径、当前修订和修订文件读取均指向 linked worktree。
