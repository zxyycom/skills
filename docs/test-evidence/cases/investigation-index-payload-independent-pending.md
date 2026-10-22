### Case IR-INDEX-PAYLOAD-PENDING-RECHECK-001: index独立写前复核全域pending身份

Tests:
- `test:7e8b02954cb4dcf3f9227112c0018622abab26a5cbf938244fd7700d01596c32`

Tags:
- `investigation-report`

Contract:
- IR index准备阶段复用初始pending，不取消独立写前全域pending路径、模式与OID身份复核。

Proves:
- 初始快照取得后、独立写前 phase 前改变未选 OID，stage 返回 pending-conflict 且保留并发 index 现场。
