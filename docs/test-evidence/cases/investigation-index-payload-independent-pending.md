### Case IR-INDEX-PAYLOAD-PENDING-RECHECK-001: index独立写前复核全域pending身份

Tests:
- `test:6aa47b02711708feac81e96ba4ec767f3125b7db11009be25d3cbff56a44ca0f`
- `test:6ae766a9c17110f13e4a38d2be04ef12fd3acb85b2075bd05b1fb9c029f06e44`
- `test:7e8b02954cb4dcf3f9227112c0018622abab26a5cbf938244fd7700d01596c32`
- `test:849d4dd3156b774b9883cbe5495cfe70183fc73ff292e74e6946cf179c07dccd`

Tags:
- `investigation-report`

Contract:
- IR index准备阶段复用初始pending，不取消独立写前全域pending路径、模式与OID身份复核。

Proves:
- 初始快照取得后、独立写前 phase 前改变未选 OID、mode、成员增加或 staged 删除，stage 返回 pending-conflict 且保留并发 index 现场。
