### Case DECISION-EVOLVE-DISCARD-RELATION-HISTORY-001: 删除确认不代替关系历史确认

Tests:
- `test:48402e38c0fb38ebe0161900886819347ebec20d7721b067c63dc5638cd7a02c`

Tags:
- `decision-records`

Contract:
- delete-recorded 只确认删除目标，不能绕过最终关系中未记录前序的独立历史确认。

Proves:
- 真实 Git fixture 中删除目标已记录、关系前序未记录，开启 delete-recorded 后预检仍要求历史确认且索引不变；再显式确认历史后提交，删除目标并归档关系前序。该节点不验证 CLI renderer。
