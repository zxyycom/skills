### Case INVESTIGATION-STAGE-MISSING-001: 两份索引都缺失的主题 ID 在写入前失败
Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index rejects topic ids missing from both indexes without changing pending`
- `bun test --test-name-pattern="^stage-index rejects topic ids missing from both indexes without changing pending$" ./tools/investigation-report/tests/run.ts`
Contract:
- 只有至少存在于 revision 索引或工作区索引之一的规范主题 ID 才能参与选择性暂存。
Proves:
- 缺失 ID 返回带原 ID 的 `state-index.selected-id-missing`，没有创建 pending，工作区索引字节不变。
