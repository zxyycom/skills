### Case DECISION-SEARCH-STATUS-001: Decision search 默认活动记录并可选择归档记录

Tests:
- `test:9aeaf5b78db981b45bac9a30ff2e32bcda1a12525b18b941ffdd370d3a5b525d`

Tags:
- `decision-records`

Contract:
- Decision search 默认只搜索 active 决策，显式 status=archived 时搜索归档决策及其 archive sourcePath 与明确 alignment。

Proves:
- 默认查询不返回匹配的归档 Decision ID。
- archived 查询返回该 ID、archive 下的 sourcePath、archived/unaligned，且不含 unknown 或 null。
