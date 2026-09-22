### Case INVESTIGATION-STAGE-DEFINITION-UPGRADE-001: stage --scope index validates canonical Investigation IDs before repository access

Tests:
- `test:da4f23f03779fccdc60f651efc98060db9eec5b490f23a8ada890136a3873aaa`

Tags:
- `investigation-report`

Contract:
- 选择性暂存在访问仓库或工作区前校验规范 Investigation ID。

Proves:
- 对不存在的临时 root 传入路径 ID，返回 invalid-ID 诊断而该 root 不被创建。
