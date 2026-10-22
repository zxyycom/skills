### Case DECISION-STAGE-MOVE-001: 选择同一 ID 的当前 sourcePath 并构建移动投影

Tests:
- `test:d6c5b6a134f6e486713495e46865c80ad6cd1234061a752a98a0f4860d7f1030`

Tags:
- `decision-records`

Contract:
- 同一 ID 从 root 移到 archive 后，stage 清理旧 pending 路径并暂存当前归档来源。

Proves:
- 真实 stage 成功暂存 archive/selected.md 的 archived 正文，并移除旧 selected.md 的 pending 路径。
