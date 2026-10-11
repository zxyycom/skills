### Case DECISION-PUBLISHED-QUERY-NO-SOURCE-001: 发布查询不读取或发现 Markdown

Tests:
- `test:570a429a3d3d117bc7091cfb93e008b2131dfaaa01acab7ee814753d7a6a3703`

Tags:
- `decision-records`

Contract:
- list、trace 与 metadata search 只查询完整验证的发布索引，source 固定标识未核对当前来源的发布快照，正常来源状态没有 warning。

Proves:
- 拦截 Markdown readFile 与目录 readdir 时三个入口仍成功、来源固定且无 warning，二者次数均零；同条件 show 只尝试读取一个目标并失败。
