### Case DECISION-SELECTED-SYNC-MEMBERSHIP-001: Decision sync re-discovers complete established membership after an earlier scan

Tests:
- `test:131ee26773e80ce6fc3b9ad1ced14789fe276793a669bc0db8015d2a9a2b1447`

Tags:
- `decision-records`

Contract:
- Decision sync 的 candidate 与 source revision 必须在 runtime read/readRevision 时重新发现完整 established 集合，不能固定使用较早 scan 的成员集合。

Proves:
- scan 后新增或删除未选择的 established ID 时，selected write 返回完整 changed ID 集合、零写入失败。
- full sync 先发布完整新增成员后，再删除该成员仍会作为未选择变化被发现。
