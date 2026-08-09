### Case INDEX-RUNTIME-STAGING-COLLECTION-001: 不读取领域源并拒绝集合级变化

Entry:
- `tools/index-runtime/tests/staging.test.ts > rejects collection changes without source reads`
- `bun test --test-name-pattern="^rejects collection changes without source reads$" ./tools/index-runtime/tests/run.ts`

Contract:
- revision 已有索引时，按 ID 暂存不能选择 metadata 或 metadata 来源 revision。

Proves:
- metadata 内容或 metadata 来源指纹变化都在 pending 写入前返回 `collection-changed`。
- 失败前不调用领域 `read` 或 `readRevision`，也不改变 pending。
