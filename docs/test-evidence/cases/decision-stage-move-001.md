### Case DECISION-STAGE-MOVE-001: 按 sourcePath 暂存选择的 ID 移动

Tests:
- `test:865ae269438d8c074591b0ba74352a4ffa5f6ddf8dd269f00647b639b2a6a68e`

Tags:
- `decision-records`

Contract:
- 选择同一 ID 时，root 到 archive 的 sourcePath 变化必须作为该 ID 的移动和派生 index 暂存。

Proves:
- stage 输出包含 root→archive rename 和 decision-index。
