### Case DECISION-STAGE-INPUT-001: Stage 在准备边界拒绝无效、重复和缺失 ID

Tests:
- `test:b7696e7281d3985d884b2c0877cdc9cd7a34c8633d4f7b0686ecf7df072c8769`

Tags:
- `decision-records`

Contract:
- stage 在访问工作区前拒绝重复和越界的选择输入。

Proves:
- 服务入口在不存在的 workspace 路径上，仍将重复 ID 与越界输入拒绝为退出码 2 的参数诊断。
