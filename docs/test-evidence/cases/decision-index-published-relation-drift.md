### Case DECISION-INDEX-PUBLISHED-RELATION-DRIFT-001: 关系查询读取已发布关系

Tests:
- `test:398e9d0f7d82933d4600f613a50fa29cf9016eccf39ca0dc81e15d0e6d53b0be`
- `test:3cad69a8c65e25f8d5be408deedb9aafeb16bd1813608a8e63da65af0d01eaa9`

Tags:
- `decision-records`

Contract:
- 关系查询读取已发布关系。

Proves:
- 原生 trace 投影从已发布索引返回修订边，并把来源标记为 `published-index / unchecked / false`；该节点不修改工作区。
- 另一个真实 CLI fixture 在索引有效后更改来源正文，严格 check 失败并报告 `index-not-current`；它不声称同一 fixture 覆盖关系变更。
