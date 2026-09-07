### Case DECISION-MEMORY-SOURCE-BOUNDARY-001: 内存决策源在派生前验证身份与路径

Tests:
- `test:4e27a43c810065bb59f933b83859cf6d24c2a19e6906c27b5fd806459d291c17`

Tags:
- `decision-records`

Contract:
- 内存输入的决策源在生成 revision 或状态快照前必须验证 Decision ID、sourcePath 格式及两者身份一致性。

Proves:
- 非法 ID、非法 sourcePath 和 ID/path 不匹配均在 revision 派生入口抛出对应类型错误。
