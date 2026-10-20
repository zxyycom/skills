### Case DECISION-INDEX-REVISION-001: 索引 revision 跟踪标签和 sourcePath

Tests:
- `test:69f7831fdbc2064240858c952253393e653b0fa450cfeb8f368ca699519406e4`

Tags:
- `decision-records`

Contract:
- 标签或 sourcePath 变化必须使持久索引 revision 失效；只有重建后才接受新快照。

Proves:
- 真实 Markdown tags 改动使严格验证失败；同步后持久索引保留排序的新 tags。
- 来源改为 semantic-current.md 后再次报告 out of sync；同步后同一 ID 的索引 sourcePath 更新为新位置。
