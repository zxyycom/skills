### Case DECISION-STAGE-METADATA-COMPATIBILITY-001: 暂存拒绝不兼容集合revision

Tests:
- `test:209cd28edb2af1907658f2657c31b736598267a873c504290b608ccad2617548`

Tags:
- `decision-records`

Contract:
- pending 和工作区索引的集合 revision metadata 不兼容时 index/all 不能组合投影。

Proves:
- 真实 Git 中 pending 索引的 sourceRevision.metadata 不同时，index 与 all 均失败且 pending 条目不变。
