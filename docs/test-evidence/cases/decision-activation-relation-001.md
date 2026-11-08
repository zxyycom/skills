### Case DECISION-ACTIVATION-RELATION-001: Publish 建立候选来源关系并归档活动目标

Tests:
- `test:1f6927e8d3d0f8b61640dc9f548d73e39a13056d72039ff1b6d773366d78189a`

Tags:
- `decision-records`

Contract:
- 发布带修订关系的后继会建立关系并归档活动前序。

Proves:
- 预检列出待归档前序且未建归档目录；提交后前序移动到 archive，索引前序状态为 archived、后继关系 target 为该前序。
