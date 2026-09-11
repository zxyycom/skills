### Case INVESTIGATION-RELATION-FILTER-002: list and search combine direct relation selectors with existing query boundaries

Tests:
- `test:2649633d1aaffdaf4ab289c41d42452bc3c15447006c8c1a6fa401f309a05adf`

Tags:
- `investigation-report`

Contract:
- `list` 与 `search` 在各自查询 snapshot 中按一个目标的直接前序、后继或两者筛选；relation type 与目标同现时匹配同一条边，且关系筛选先于 list 分页或文本匹配。

Proves:
- API 与 CLI 分别返回三种方向和默认双向的直接结果；默认双向结果按 formedAt 倒序后再应用 offset/limit，保留 tag、时间与 total 语义，并拒绝无目标 direction 或缺失 selector。
- content fallback 从单次验证内存 snapshot 计算关系；metadata 保持只读索引，结构关系筛选不伪装为 `matchedRelations` 文本证据。
