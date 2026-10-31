### Case DECISION-SELECTED-SYNC-MEMBERSHIP-001: Decision sync re-discovers complete established membership after an earlier scan

Tests:
- `test:c12ef7eaaa0978a4943279cb583e64355419c0dd4c2dc82b2cc65a3b6d9f6da7`

Tags:
- `decision-records`

Contract:
- Decision sync 的 candidate 与 source revision 必须在 runtime read/readRevision 时重新发现完整 established 集合，不能固定使用较早 scan 的成员集合。

Proves:
- scan 后新增或删除未选择的 established ID 时，selected write 返回完整 changed ID 集合、零写入失败。
- full sync 先发布完整新增成员后，再删除该成员仍会作为未选择变化被发现。
