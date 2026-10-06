### Case NOVEL-CARDS-COUNT-BUDGET-018: 卡片数量上限

Tests:
- `test:bc2d97d09596d36d4b51b2823647ab5bd62fb83760e777be0abfe79c78a15a53`

Tags:
- `novel-cards`

Contract:
- 完整集合最多10000卡，超出后不得返回部分成功。

Proves:
- 恰好10000张合法卡完整读取；增加第10001张卡以source-limit失败。
