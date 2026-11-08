### Case INVESTIGATION-RESOURCE-INVALID-OWNER-ANCHOR-001: owner report must exist for a report-owned resource

Tests:
- `test:4e572abfeea52b35c3c4bffc062551f60a2a20ffd64dd908e460bd7d795d107a`

Tags:
- `investigation-report`

Contract:
- 调查索引资源 ID 的 owner report 必须存在。

Proves:
- 完整有效索引中将 consumer 的 resourceId 指向不存在的 owner 后，原生图校验失败。
