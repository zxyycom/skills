### Case DECISION-RELATION-FILTER-001: Decision list 与 search 按直接关系筛选

Entry:
- `tools/decision-records/tests/queries.test.ts > decision list and search combine direct relation conditions`
- `bun test --test-name-pattern="^decision list and search combine direct relation conditions$" ./tools/decision-records/tests/run.ts`

Contract:
- `list` 与 `search` 使用标准 ID 优先、唯一 name 回退的单个关系目标，按相对目标的直接 predecessors、successors 或默认 both，并先与 status、AND tag 和可选同边 relation type 取交集。
- content search 只搜索结构筛选后的权威文件，并在持久索引陈旧时从同次只读验证快照完成关系筛选；metadata search 保持其文本命中证据，不将关系结构筛选伪装为 relation summary 命中。

Proves:
- API 与 CLI 分别返回目标的直接前序、后继和默认双向结果；status 与 tag 继续收窄前序结果。
- 独立 relation type 选择包含该类型边的来源；目标与不匹配 type 共同选择成功返回空集合。
- content 与 metadata search 都排除不相关记录；持久索引中已失效的 relation type 不会在 fallback 中选中正文；metadata 的 `matchedRelations` 仍只反映实际文本命中，且 CLI 拒绝无目标 direction。
