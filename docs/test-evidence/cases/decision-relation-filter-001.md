### Case DECISION-RELATION-FILTER-001: Decision list 与 search 按直接关系筛选

Tests:
- `test:c1070cfb2004704eb53c24a1e30ca9b2caea60dc56ed00aae36fd2b0b72db203`

Tags:
- `decision-records`

Contract:
- `list` 与 `search` 使用标准 ID 优先、唯一 name 回退的单个关系目标，按相对目标的直接 predecessors、successors 或默认 both，并先与 status、AND tag 和可选同边 relation type 取交集。
- 关系条件独立投影同次快照的筛选边；content search 只搜索结构筛选后的权威文件并按已发布关系筛选当前正文，metadata 的 `matchedRelations` 仍只承接文本命中。

Proves:
- API 与 CLI 分别返回目标的直接前序、后继和默认双向结果；status 与 tag 继续收窄前序结果，独立 relation type 与不匹配 type 组合保持原选择语义。
- list、content 与 metadata search 都显示 anchor 来源的筛选依据；metadata 的 `matchedRelations` 仍为 none，当前正文未同步关系时仍使用发布修订边，而非未同步的替代边。
