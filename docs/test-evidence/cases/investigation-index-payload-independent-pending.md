### Case IR-INDEX-PAYLOAD-PENDING-RECHECK-001: index独立写前复核全域pending身份

Tests:
- `test:6ae766a9c17110f13e4a38d2be04ef12fd3acb85b2075bd05b1fb9c029f06e44`
- `test:7e8b02954cb4dcf3f9227112c0018622abab26a5cbf938244fd7700d01596c32`
- `test:ddd6f77fe0f17e0926cc6cbbc4c20741ed39750ae9c95ea72b566c7d8cc477ce`

Tags:
- `investigation-report`

Contract:
- IR index准备阶段复用初始pending，不取消独立写前全域pending路径、模式与OID身份复核。

Proves:
- 初始快照取得后、独立写前phase前改变未选OID、模式或成员，stage返回pending-conflict且保留并发index现场。
