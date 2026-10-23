### Case RECORD-TRANSACTION-HANDLE-OWNERSHIP-001: 共同恢复只认领实际写handle身份

Tests:
- `test:191a8b6f7402a6dd92d5c4638d32de3b1cfbf34e7bc68f57c9d3a3fa8df9f77e`
- `test:e67c1149be031f1570aa629bc425858b7dfe8f910fa5318b461bea4aa752110b`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 写后采集须匹配实际write handle的dev／ino；opaque writer未证明新inode归属时不能CAS撤销。

Proves:
- 在默认原位write handle close后、capture前用同new bytes／mode的新inode替换，拒绝认领、保留winner与旧index、返回partial；custom writer原子替换但不给ownership proof后遇index失败同样保留新来源。
