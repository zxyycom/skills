### Case NOVEL-CARDS-CHAPTER-CANDIDATES-019: 章节候选与scope

Tests:
- `test:63df1f9bce1df40a485ef62285b8dd1f498b5da5171a3be3603dd32042765ede`

Tags:
- `novel-cards`

Contract:
- 标题允许重名；当前章号只在显式实际剧情scope内唯一，定位不能猜测。

Proves:
- 同名章节与跨scope同号返回全部候选和歧义标记；选scope后唯一并回显scopeTitle；同scope重复号或不存在scope被拒绝。
