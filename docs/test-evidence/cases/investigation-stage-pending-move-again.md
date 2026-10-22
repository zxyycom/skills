### Case INVESTIGATION-STAGE-PENDING-MOVE-AGAIN-001: 再次移动清理上次 pending 正文位置

Tests:
- `test:e82bc579f3781cfd85d2ec79a9b7773a605bb436f8ba26535ffa2d946694ff09`

Tags:
- `investigation-report`

Contract:
- domain/all 选中同一身份再次移动时清理 HEAD 和已暂存的旧路径，保留最新 worktree 发布位置。

Proves:
- 同一报告先移到 middle 再移到 final 并逐次暂存，HEAD 和 middle 两处均不在 pending，final 恰好存在。
