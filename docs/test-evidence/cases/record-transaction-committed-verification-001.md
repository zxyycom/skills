### Case RECORD-TRANSACTION-COMMITTED-VERIFICATION-001: 共同事务区分提交后验收与清理失败

Tests:
- `test:0df493e38b3a9602050f78f6214ec5449e43b06ad3505ebd696bdb3e8b01a7fa`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 提交后验收失败不自动回滚，清理失败另列。

Proves:
- 提交后同时验收和清理注错，保留来源与索引新字节、known committed、failed-or-unknown及两组错误。
