### Case DECISION-REALLOCATION-PURITY-001: 重划图的关系类型边界

Tests:
- `test:7b51c6051faa3cf1fc1d60e8b03cdc2957686f8099d43631b1ae0db5eacc288f`

Tags:
- `decision-records`

Contract:
- 重划后继不能混合重划和其他关系类型。

Proves:
- 原生索引图测试将有效重划后继的一条边改为修订后，验证拒绝该图；未断言具体诊断或事务写入。
