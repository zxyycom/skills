### Case DR-LOCAL-PUBLISHED-BOUNDARIES-001: 实际改写者保留来源漂移保护

Tests:
- `test:49d20586f694da8548606795f8dc905e9ecdccf9a59d493a46766f2773de971f`
- `test:5274198dc0b35bf7edbdef0c7a0d8d874caec90288d47b85b68402b55519bab8`
- `test:6fc326b26ddadc5dcc5d938f7bdadc6d03a768870e19003ad68a2c6f96cb9dfb`

Tags:
- `decision-records`

Contract:
- 普通维护仅读所选与实际改写正文；被实际归档的 active 前序和将被改写的正式引用者均须匹配发布 revision。

Proves:
- 候选发布前 active 前序有未同步编辑时明确 sync-index 失败，候选与索引不变，前序外部编辑保留。
- 正式引用者有未同步编辑时 rename 从索引发现该入边并拒绝，目标原文与索引不变，引用者外部编辑保留。
- 更名 target 完整 ID 被任意 basename 候选占用时，按 target 候选身份发现明确失败；两份候选和正式索引字节均保持。
