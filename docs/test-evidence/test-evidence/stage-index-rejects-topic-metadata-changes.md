### Case TEST-EVIDENCE-STAGE-METADATA-001: Topic Metadata 变化拒绝按 Case 暂存

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index rejects topic metadata changes`
- `bun test --test-name-pattern="^stage-index rejects topic metadata changes$" ./tools/test-evidence/tests/run.ts`

Contract:
- 完整 topic 表及其来源指纹属于集合级 metadata，不能归入单个 Case ID 的选择。

Proves:
- topic 描述相对 revision 变化时返回 `collection-changed`。
- 拒绝结果不会产生 pending 路径。
