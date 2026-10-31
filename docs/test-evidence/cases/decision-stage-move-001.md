### Case DECISION-STAGE-MOVE-001: 选择同一 ID 的当前 sourcePath 并构建移动投影

Tests:
- `test:dd8896eb5edc8bb84cb0eba2accf6b4b4b405b9fcf2e8e0e6b018c2d58968e96`

Tags:
- `decision-records`

Contract:
- 同一 ID 从 root 移到 archive 后，stage 清理旧 pending 路径并暂存当前归档来源。

Proves:
- 真实 stage 成功暂存 archive/selected.md 的 archived 正文，并移除旧 selected.md 的 pending 路径。
