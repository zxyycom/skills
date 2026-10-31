### Case DR-LOCAL-PUBLISHED-BOUNDARIES-001: 实际改写者保留来源漂移保护

Tests:
- `test:225007b1eb0107b2284bb20b171ce24e7248fbfda0495598f8e44bac821317ce`
- `test:5a042b818757ccd6275c74dea3c2b4b9abe53f191267fdebfda85dbae6537fc8`
- `test:c54c24c76bdc4b57d7cd6f953eea985ebf0043b3a0039ed2318fe33522ffded9`

Tags:
- `decision-records`

Contract:
- 普通维护仅读所选与实际改写正文；被实际归档的 active 前序和将被改写的正式引用者均须匹配发布 revision。

Proves:
- 候选发布前 active 前序有未同步编辑时明确 sync-index 失败，候选与索引不变，前序外部编辑保留。
- 正式引用者有未同步编辑时 rename 从索引发现该入边并拒绝，目标原文与索引不变，引用者外部编辑保留。
- 更名 target 完整 ID 被任意 basename 候选占用时，按 target 候选身份发现明确失败；两份候选和正式索引字节均保持。
