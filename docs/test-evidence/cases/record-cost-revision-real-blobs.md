### Case RECORD-COST-CASE-027: 精确版本批量读取

Tests:
- `test:e81a70d43c6909e9fc3593627ca1ac21cb460fbb58ecc3254ae1e3f47ba1a388`

Tags:
- `record-cost`

Contract:
- 固定 revision 的多个文件按受限 Git 批次读取。

Proves:
- 100 个真实 blob 的树查询和对象读取各一次。
