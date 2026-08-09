### Case INDEX-RUNTIME-STAGING-PROJECTION-001: 完整重投影后拒绝非法选择目标

Entry:
- `tools/index-runtime/tests/staging.test.ts > rejects an invalid selected target after complete reprojection without source reads`
- `bun test --test-name-pattern="^rejects an invalid selected target after complete reprojection without source reads$" ./tools/index-runtime/tests/run.ts`

Contract:
- 按 ID 组合出的目标必须重新执行完整投影与领域级索引验证，且不能回读领域源。

Proves:
- 单独合法的 revision 与工作区索引合成非法跨条目结果时返回 `target-invalid`。
- 领域验证回调观察到完整的选择目标并以 `state-index.index-validation-failed` 拒绝。
- 失败前不调用领域 `read` 或 `readRevision`，也不改变 pending。
