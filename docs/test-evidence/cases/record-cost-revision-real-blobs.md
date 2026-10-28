### Case RECORD-COST-CASE-027: 精确版本批量读取

Tests:
- `test:f1848e457af44cfc90641e393debc7ac81fe37e5d45d3d6e32c31c34682c717f`

Tags:
- `record-cost`

Contract:
- 固定 revision 的多个文件按受限 Git 批次读取。

Proves:
- 100 个真实 blob 的树查询和对象读取各一次。
