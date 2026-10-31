### Case DECISION-FILTER-EVIDENCE-DIRECTIONS-001: 方向类型组合保持同边筛选与省略边界

Tests:
- `test:1252bc2117111793ac9409ba106af19b27e88575aabe01a9112431ffda2bcdc3`

Tags:
- `decision-records`

Contract:
- 关系筛选按同一条边的 anchor、方向与 type 条件投影 evidence；未使用条件时省略 filterRelations。

Proves:
- both 与 type 的组合保留前驱/后继 source、target 和 summary 的完整证据，无条件查询不附 evidence。
