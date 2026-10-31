### Case DECISION-ACTIVATION-RELATION-001: Publish 建立候选来源关系并归档活动目标

Tests:
- `test:4a24c90c351932c910de1e93968a05b17d5702d9f81bf77b23012c2ff8632dfc`

Tags:
- `decision-records`

Contract:
- publish 只携带候选自身保存的完整关系作为最终关系，并与候选建立、活动前序归档和索引重建在同一事务中生效；预检和提交都返回 establish relationReview。

Proves:
- 带摘要来源关系的候选预检显示 establish action、before/after 集合且候选字节不变。
- 提交显示 committed review，索引保留同一摘要关系，并归档关系指向的活动前序。
