### Case DECISION-INDEX-REVISION-001: 索引 revision 跟踪标签和 sourcePath

Tests:
- `test:69f7831fdbc2064240858c952253393e653b0fa450cfeb8f368ca699519406e4`

Tags:
- `decision-records`

Contract:
- 标签或 sourcePath 变化必须使持久索引 revision 失效；只有重建后才接受新快照。

Proves:
- 改 tags 后严格验证失败；sync-index 后索引含排序后的新 tags。
