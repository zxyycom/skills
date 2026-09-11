### Case DECISION-STAGE-MOVE-001: 按 sourcePath 暂存选择的 ID 移动

Tests:
- `test:d6c5b6a134f6e486713495e46865c80ad6cd1234061a752a98a0f4860d7f1030`

Tags:
- `decision-records`

Contract:
- 选择同一 ID 时，root 到 archive 的 sourcePath 变化必须作为该 ID 的移动和派生 index 暂存。

Proves:
- stage 输出包含 root→archive rename 和 decision-index。
