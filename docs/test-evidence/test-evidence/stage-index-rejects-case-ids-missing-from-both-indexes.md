### Case TEST-EVIDENCE-STAGE-MISSING-001: 两份索引都缺失的 Case ID 在写入前失败

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index rejects case ids missing from both indexes`
- `bun test --test-name-pattern="^stage-index rejects case ids missing from both indexes$" ./tools/test-evidence/tests/run.ts`

Contract:
- 只有至少存在于 revision 索引或工作区索引之一的合法 Case ID 才能参与选择性暂存。

Proves:
- 两份索引都缺失的 ID 返回 `state-index.selected-id-missing`。
- pending 与工作区索引保持不变。
