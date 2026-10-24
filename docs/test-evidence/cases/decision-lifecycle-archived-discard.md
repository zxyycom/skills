### Case DECISION-LIFECYCLE-ARCHIVED-DISCARD-001: 丢弃归档记录删除路径与索引身份

Tests:
- `test:e3c77a459f8892bd40cfc35b0436d5543e6906ba9881c7eb95c4548cb19ae6f3`

Tags:
- `decision-records`

Contract:
- 显式确认的归档记录丢弃同时移除来源与对应 ID-keyed 索引条目。

Proves:
- 归档后 discard --delete-recorded 成功，归档路径不存在，字面 ID use-markdown-establishment 不在索引中，剩余集合严格检查通过。
