### Case NOVEL-CARDS-METADATA-009: 字段结构与状态维度

Tests:
- `test:10b447567d65203e2a7aadee85eb1ec8aa8ca915ba0ea27b0a861c4dfba7263e`

Tags:
- `novel-cards`

Contract:
- 卡片字段严格校验，发生状态与规划完整度独立；普通history summary不代替专门transition。

Proves:
- 未知字段、错误状态、详情mixed/children、无锚点状态卡、重复引用、非人物域空relations及空正文失败；expected expanded与occurred planned合法。
