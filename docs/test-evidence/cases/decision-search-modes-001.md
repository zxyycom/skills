### Case DECISION-SEARCH-MODES-001: Decision search 以三种模式检索完整 Markdown

Tests:
- `test:fcf12b5b222d45faf800efa5fb97d74d68b8a57a63cac020c126c67cb6d9986f`

Tags:
- `decision-records`

Contract:
- Decision search 的默认范围和显式 `--in content` 都必须在已建立决策的完整 Markdown 中支持 all、any、phrase 三种文本匹配，并将命中 sourcePath 和预览与稳定 ID 一并输出。

Proves:
- 位于正文的稀有词组在默认和显式 content 的 all 查询，以及默认 any 和 phrase 查询中都返回对应 Decision ID。
- 输出含语义 sourcePath、previews 标记和正文命中片段。
