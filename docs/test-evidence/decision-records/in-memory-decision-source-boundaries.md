### Case DECISION-MEMORY-SOURCE-BOUNDARY-001: 内存决策源在派生前验证身份与路径

Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > in-memory decision sources reject invalid IDs and source paths before deriving revisions`
- `bun test --test-name-pattern="^in-memory\ decision\ sources\ reject\ invalid\ IDs\ and\ source\ paths\ before\ deriving\ revisions$" ./tools/decision-records/tests/run.ts`

Contract:
- 内存输入的决策源在生成 revision 或状态快照前必须验证 Decision ID、sourcePath 格式及两者身份一致性。

Proves:
- 非法 ID、非法 sourcePath 和 ID/path 不匹配均在 revision 派生入口抛出对应类型错误。
