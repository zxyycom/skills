### Case DECISION-ACTIVATION-RELATION-001: Publish 建立候选来源关系并归档活动目标

Tests:
- `test:d8d9ba14de32faa5b12083bee3255fe022bd211f8dd31d6104c7c7b530159fb6`

Tags:
- `decision-records`

Contract:
- publish 只携带候选自身保存的完整关系作为最终关系，并与候选建立、活动前序归档和索引重建在同一事务中生效；预检和提交都返回 establish relationReview。

Proves:
- 带摘要来源关系的候选预检显示 establish action、before/after 集合且候选字节不变。
- 提交显示 committed review，索引保留同一摘要关系，并归档关系指向的活动前序。
