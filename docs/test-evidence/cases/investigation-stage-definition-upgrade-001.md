### Case INVESTIGATION-STAGE-DEFINITION-UPGRADE-001: stage-index validates canonical Investigation IDs before repository access

Tests:
- `test:c21c3f2227725925901fd4834bb6f6ccced2aae4781a4b4d872059c90c03411f`

Tags:
- `investigation-report`

Contract:
- 选择性暂存在访问仓库或工作区前校验规范 Investigation ID。

Proves:
- 对不存在的临时 root 传入路径 ID，返回 invalid-ID 诊断而该 root 不被创建。
