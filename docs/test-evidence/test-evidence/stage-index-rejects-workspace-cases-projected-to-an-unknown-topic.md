### Case TEST-EVIDENCE-STAGE-TOPIC-001: 未知 Topic 投影在暂存前失败

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index rejects workspace cases projected to an unknown topic`
- `bun test --test-name-pattern="^stage-index rejects workspace cases projected to an unknown topic$" ./tools/test-evidence/tests/run.ts`

Contract:
- 工作区索引中的每个 Case `sourcePath` 与 topic key 必须属于 metadata 定义的 topic，领域归属由现有 definition 完整校验。

Proves:
- 未知 topic 投影返回 `workspace-index-invalid` 与定位到目标 Case 的稳定索引诊断。
- 无效工作区索引不会进入 pending。
