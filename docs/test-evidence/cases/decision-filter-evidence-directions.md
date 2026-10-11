### Case DECISION-FILTER-EVIDENCE-DIRECTIONS-001: 方向类型组合保持同边筛选与省略边界

Tests:
- `test:2e3e5586e37881f239694ce62be0bd7f0aeb6cbb911148c77ebb9fe0410af89a`

Tags:
- `decision-records`

Contract:
- 关系筛选按同一条边的 anchor、方向与 type 条件投影 evidence；未使用条件时省略 filterRelations。

Proves:
- both 与 type 的组合保留前驱/后继 source、target 和 summary 的完整证据，无条件查询不附 evidence。
