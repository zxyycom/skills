### Case DECISION-SEARCH-MODES-001: Decision search 以三种模式检索完整 Markdown

Tests:
- `test:4a4af5f498ba682c867aaea4e95f7e2081a8fcb8095d39575ff4fb85f227fc03`

Tags:
- `decision-records`

Contract:
- Decision search 的默认范围和显式 `--in content` 都必须在已建立决策的完整 Markdown 中支持 all、any、phrase 三种文本匹配，并将命中 sourcePath 和预览与稳定 ID 一并输出。

Proves:
- 位于正文的稀有词组在默认和显式 content 的 all 查询，以及默认 any 和 phrase 查询中都返回对应 Decision ID。
- all 加入缺失词时零命中，phrase 的非连续词组合零命中；输出含语义 sourcePath、previews 标记和正文命中片段。
