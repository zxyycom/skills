### Case INDEX-RUNTIME-STAGING-COLLECTION-001: 不读取领域源并拒绝集合级变化

Tests:
- `test:0ba4856c8a801c6d66df352d6106740a829b8f220ea796296b29c91fed784007`

Tags:
- `index-runtime`

Contract:
- revision 已有索引时，按 ID 暂存不能选择 metadata 或 metadata 来源 revision。

Proves:
- metadata 内容或 metadata 来源指纹变化都在 pending 写入前返回 `collection-changed`。
- 失败前不调用领域 `read` 或 `readRevision`，也不改变 pending。
