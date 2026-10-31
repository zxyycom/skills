### Case AUTO-PUSH-CONFLICT-001: Main 自动推送拒绝远端分叉

Tests:
- `test:bcdc19b9241e5bc4485a302d0db26b48b1a38f6f92ea0c971858976d8945e94a`

Tags:
- `repository-tooling`

Contract:
- 自动推送不得用 force 或其他降级覆盖已经分叉的远端 main，推送失败不得撤销本地 commit。

Proves:
- 竞争 clone 先更新远端 main 后，启用真实 post-commit 的本地 commit 仍成功；远端保持竞争 revision，本地 HEAD 保持已完成的本地 commit。
