### Case DECISION-ACTIVATION-ARCHIVE-001: 发布候选建立创建身份并拒绝重复发布

Tests:
- `test:6f90a363b908a665b8dabd54abe86b6c92b8b67c389970a16dfdb67192a8739d`

Tags:
- `decision-records`

Contract:
- publish 建立候选并赋予创建身份，正式记录不能重复发布。

Proves:
- 真实 CLI 发布 ready 候选后索引包含该 ID、aligned 和 UTC createdAt；重复发布失败且正文、索引字节不变。
