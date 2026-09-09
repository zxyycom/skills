### Case AUTO-PUSH-CONFLICT-001: Main 自动推送拒绝远端分叉

Tests:
- `test:3e9878379336f88b51b6ca961f25814979f62863d45b53a4f3efdca5a4fe50f8`

Tags:
- `repository-tooling`

Contract:
- 自动推送不得用 force 或其他降级覆盖已经分叉的远端 main，推送失败不得撤销本地 commit。

Proves:
- 竞争 clone 先更新远端 main 后，启用真实 post-commit 的本地 commit 仍成功；远端保持竞争 revision，本地 HEAD 保持已完成的本地 commit。
