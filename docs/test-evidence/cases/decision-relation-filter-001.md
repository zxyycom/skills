### Case DECISION-RELATION-FILTER-001: Decision list 与 search 按直接关系筛选

Tests:
- `test:ff985a5cba85da53144e43a674377463d7d1db77ba9a603f2ea21746389ab8ac`

Tags:
- `decision-records`

Contract:
- `list` 与 `search` 使用标准 ID 优先、唯一 name 回退的单个关系目标，按相对目标的直接 predecessors、successors 或默认 both，并先与 status、AND tag 和可选同边 relation type 取交集。
- 关系条件独立投影同次快照的筛选边；content search 只搜索结构筛选后的权威文件并在持久索引陈旧时从同次只读验证快照完成筛选，metadata 的 `matchedRelations` 仍只承接文本命中。

Proves:
- API 与 CLI 分别返回目标的直接前序、后继和默认双向结果；status 与 tag 继续收窄前序结果，独立 relation type 与不匹配 type 组合保持原选择语义。
- list、content 与 metadata search 都显示 anchor 来源的筛选依据；metadata 的 `matchedRelations` 仍为 none，陈旧索引 fallback 使用已验证内存中的替代边而非旧 relation type。
