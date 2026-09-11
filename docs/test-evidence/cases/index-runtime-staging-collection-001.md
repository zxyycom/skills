### Case INDEX-RUNTIME-STAGING-COLLECTION-001: 不读取领域源并拒绝集合级变化

Tests:
- `test:1330c0aaf198a3008e8f21206cbc26d74e140f0f9c3d1fc28d9f3cb94994f475`

Tags:
- `index-runtime`

Contract:
- revision 已有索引时，按 ID 暂存不能选择 metadata 或 metadata 来源 revision。

Proves:
- metadata 内容或 metadata 来源指纹变化都在 pending 写入前返回 `collection-changed`。
- 失败前不调用领域 `read` 或 `readRevision`，也不改变 pending。
