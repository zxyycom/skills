### Case INVESTIGATION-STAGE-DEFINITION-UPGRADE-001: stage --scope index validates canonical Investigation IDs before repository access

Tests:
- `test:419e788697915cd08995feeee2d49f03340606353c242ee95aa86c15f11b9933`

Tags:
- `investigation-report`

Contract:
- 选择性暂存在访问仓库或工作区前校验规范 Investigation ID。

Proves:
- 对不存在的临时 root 传入路径 ID，返回 invalid-ID 诊断而该 root 不被创建。
