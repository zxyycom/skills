### Case VERSION-CONTROL-WORKTREE-001: 将 linked worktree 作为独立仓库根打开

Tests:
- `test:86b8f95d9b28f0f8fc03f16615e827750de0504fa66a028724200f902339a94b`

Tags:
- `version-control`

Contract:
- linked worktree 必须以自身工作树目录为仓库根，同时共享可读修订对象。

Proves:
- 从嵌套目录打开后根路径、当前修订和修订文件读取均指向 linked worktree。
