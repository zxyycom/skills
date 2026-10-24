### Case RECORD-TRANSACTION-COMMITTED-VERIFICATION-001: 共同事务区分提交后验收与清理失败

Tests:
- `test:78ff4fb25772bff1757396da45f17c42b50b6f251116ebbef4babdc2f1f606b6`
- `test:befb2de8f459f6da91d89dde69b965812fc179cb90727c2b734275c9ec979922`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 提交后验收失败不自动回滚，清理失败另列。

Proves:
- 提交后同时验收和清理注错，保留来源与索引新字节、known committed、failed-or-unknown及两组错误。
