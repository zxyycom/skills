### Case INDEX-RUNTIME-STAGING-PROJECTION-001: 重投影选择结果并拒绝集合级变化

Entry:
- `tools/index-runtime/tests/staging.test.ts > rejects collection changes and invalid selected projections without source reads`
- `bun test --test-name-pattern="^rejects collection changes and invalid selected projections without source reads$" ./tools/index-runtime/tests/run.ts`

Contract:
- 既有基线下条目级暂存不能选择 metadata 或 metadata 来源 revision；组合后的目标必须重走 parser、key 投影和完整 `validateIndex`，且不得调用领域 `read` 或 `readRevision`。

Proves:
- metadata 内容或 metadata 来源指纹变化都在 pending 写入前返回 `collection-changed`。
- 单独合法的 revision 与工作区索引合成非法跨条目结果时，完整目标验证返回 `target-invalid`。
- 调用计数证明目标重新执行 state parser、key derive 与完整验证，同时领域 `read` 和 `readRevision` 保持零次。
