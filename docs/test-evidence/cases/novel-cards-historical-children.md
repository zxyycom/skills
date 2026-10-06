### Case NOVEL-CARDS-HISTORICAL-CHILDREN-036: 显式历史版本组成

Tests:
- `test:ca3e9dfddcef1b9f8881af7bda83d7abfd6863dbc8ab62a9fc05d1e8378e1c43`

Tags:
- `novel-cards`

Contract:
- 本作summary可显式按id@N组成同域快照；真实版本分别计预算，版本组成图仍无环，不自动推断时序。

Proves:
- 人物阶段总结按两个明确版本展开，卡数预算保留准确未读frontier，足额返回旧/新两版；跨域snapshot和跨版本循环分别被拒绝。
