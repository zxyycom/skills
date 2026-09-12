### Case DECISION-ACTIVATION-RELATION-001: Activate 建立候选来源关系并归档活动目标

Tests:
- `test:3160a6fdb7510e565514ab89605ffdb43f80b1398f1d9601301c0b9600476c22`

Tags:
- `decision-records`

Contract:
- 新候选未收到 CLI 关系覆盖时，自身保存的完整关系必须成为最终关系，并与候选建立、活动前序归档和索引重建在同一事务中生效；预检和提交都返回 establish relationReview。

Proves:
- 带摘要来源关系的候选预检显示 establish action、before/after 集合且候选字节不变。
- 提交显示 committed review，索引保留同一摘要关系，并归档关系指向的活动前序。
