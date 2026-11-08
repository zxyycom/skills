### Case DECISION-STAGE-INPUT-001: Stage 拒绝重复与路径形选择器

Tests:
- `test:3d1eb940b1f635dd6b04d7f383cc0d9e2dc5829353ea785722f2587c9baa49d0`

Tags:
- `decision-records`

Contract:
- stage 拒绝重复和路径形选择器。

Proves:
- 真实 CLI 对重复 ID 返回退出码 2；Git 工作区的路径形选择器失败并标识输入，pending 为空。
