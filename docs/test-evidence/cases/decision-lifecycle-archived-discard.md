### Case DECISION-LIFECYCLE-ARCHIVED-DISCARD-001: 丢弃归档记录删除路径与索引身份

Tests:
- `test:2dac2ba45be515fd63d31c13502e3de6117a2af7f47da0acf7417023ef03a7ab`

Tags:
- `decision-records`

Contract:
- 显式确认的归档记录丢弃同时移除来源与对应 ID-keyed 索引条目。

Proves:
- 归档后 discard --delete-recorded 成功，归档路径不存在，字面 ID use-markdown-establishment 不在索引中，剩余集合严格检查通过。
