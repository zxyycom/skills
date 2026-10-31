### Case RECORD-TRANSACTION-COMMITTED-VERIFICATION-001: 共同事务区分提交后验收与清理失败

Tests:
- `test:5da2d43fa2e519c28531813c46cedde9ea617dcac729da72fef59acec84e4017`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 提交后验收失败不自动回滚，清理失败另列。

Proves:
- 提交后同时验收和清理注错，保留来源与索引新字节、known committed、failed-or-unknown及两组错误。
