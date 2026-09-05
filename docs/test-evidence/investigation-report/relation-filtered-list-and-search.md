### Case INVESTIGATION-RELATION-FILTER-002: list and search combine direct relation selectors with existing query boundaries

Entry:

- `tools/investigation-report/tests/index-query.test.ts > list and search combine direct relation selectors with existing query boundaries`
- `bun test --test-name-pattern="^list and search combine direct relation selectors with existing query boundaries$" ./tools/investigation-report/tests/run.ts`

Contract:

- `list` 与 `search` 在各自查询 snapshot 中按一个目标的直接前序、后继或两者筛选；relation type 与目标同现时匹配同一条边，且关系筛选先于 list 分页或文本匹配。

Proves:

- API 与 CLI 分别返回三种方向和默认双向的直接结果，保留 tag、时间、offset、limit 与 total 语义，并拒绝无目标 direction 或缺失 selector。
- content fallback 从单次验证内存 snapshot 计算关系；metadata 保持只读索引，结构关系筛选不伪装为 `matchedRelations` 文本证据。
