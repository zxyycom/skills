### Case INVESTIGATION-RELATION-FILTER-EVIDENCE-001: 关系筛选证据的同边匹配与去重

Tests:
- `test:f0286f573f8276c416a9ef97f2606fe1738d431507e4c7e6703652669f74b7e4`

Tags:
- `investigation-report`

Contract:
- 关系筛选的目标和类型必须匹配同一条边，重复边证据不重复返回。

Proves:
- 纯投影测试同时提供重复补充边和不同类型反向边，以 both 与补充筛选只返回一份目标证据，不返回类型不匹配来源。
