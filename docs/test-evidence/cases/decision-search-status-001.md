### Case DECISION-SEARCH-STATUS-001: Decision search 默认活动记录并可选择归档记录

Tests:
- `test:3793ebbf9de41d2ef23dcbddb7638a31c75bf238b2e7ebe3a6880a42c531218b`

Tags:
- `decision-records`

Contract:
- Decision metadata search 默认只搜索 active 决策，显式 status=archived 时搜索归档决策及其 archive sourcePath 与明确 alignment。

Proves:
- 真实原生 CLI 对同一匹配词默认仅返回 active ID；显式 archived 仅返回归档 ID、archive sourcePath 和 unaligned。
- 该节点不单独验证 content 搜索的状态过滤。
