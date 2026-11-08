### Case DECISION-FILTER-EVIDENCE-DIRECTIONS-001: 方向类型组合保持同边筛选与省略边界

Tests:
- `test:f0286f573f8276c416a9ef97f2606fe1738d431507e4c7e6703652669f74b7e4`

Tags:
- `decision-records`

Contract:
- 关系筛选按同一条边的 anchor、方向与 type 条件投影 evidence；未使用条件时省略 filterRelations。

Proves:
- 共享原生关系投影对 anchor、both 与 type 的组合只保留同边匹配，重复边去重；无关系条件返回 None。该节点不验证全部 Decision 类型或 CLI 呈现。
