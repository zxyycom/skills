### Case INVESTIGATION-RELATION-FILTER-002: list and search combine direct relation selectors with existing query boundaries

Tests:
- `test:2c9f69027bcc55c5794f82b5940d7f50b96b26343e0434f529498257d64c5708`

Tags:
- `investigation-report`

Contract:
- `list` 与 `search` 在各自查询 snapshot 中按一个目标的直接前序、后继或两者筛选；relation type 与目标同现时匹配同一条边，且关系筛选先于 list 分页或文本匹配。
- 筛选依据与文本命中分别承接：content 与 metadata 都投影发布 snapshot 的 filter evidence，缺索引时不进行 fallback，metadata `matchedRelations` 只保留实际摘要文本命中。

Proves:
- API 与 CLI 分别返回三种方向和默认双向的直接结果；默认双向结果按 formedAt 倒序后再应用 offset/limit，保留 tag、时间与 total 语义，并拒绝无目标 direction 或缺失 selector。
- metadata 搜索在 `matchedRelations` 为空时仍显示 filter evidence；同一中心边同时作为摘要文本命中和筛选依据时，CLI 保留两个独立 evidence 块，content 缺索引时返回错误、无成功 searchInfo，并提示显式恢复。
