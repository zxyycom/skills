### Case RECORD-TRANSACTION-HANDLE-OWNERSHIP-001: 共同恢复只认领实际写handle身份

Tests:
- `test:91b889801170c9f1c07655bf549cad8bc2aac0b095680cbe94c57238252171d8`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 写后采集须匹配实际write handle的dev／ino；opaque writer未证明新inode归属时不能CAS撤销。

Proves:
- 在默认原位write handle close后、capture前用同new bytes／mode的新inode替换，拒绝认领、保留winner与旧index、返回partial；custom writer原子替换但不给ownership proof后遇index失败同样保留新来源。
