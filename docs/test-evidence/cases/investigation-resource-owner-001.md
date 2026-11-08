### Case INVESTIGATION-RESOURCE-OWNER-001: owner report must directly reference its own resource

Tests:
- `test:17f2c43244c1324a88c7537bd6c409d1564c62039e908da6a2a2bdb0fe65fdb3`

Tags:
- `investigation-report`

Contract:
- 候选共享资源时 owner 报告须直接引用其资源。

Proves:
- owner 有直接引用时 consumer ready；去掉 owner 引用后 consumer resource readiness 失败并指出 owner 必须引用该资源。
