### Case INVESTIGATION-SEARCH-MODES-001: search 以匹配模式和结构筛选检索正式 Markdown

Tests:
- `test:e16b234192d1159553ec7aa85e1187a96b0668ac55869c1c888ef9a9280eb80e`

Tags:
- `investigation-report`

Contract:
- Investigation search 只在正式报告 Markdown 中提供 all、any、phrase 文本匹配，并能与 tag、formedAt 范围和直接 relation type 结构筛选组合；结果保持 Investigation ID 与 sourcePath 身份分离。

Proves:
- 默认 all、phrase 与带结构筛选的 any 查询均返回匹配的正式 Investigation ID。
- 匹配结果投影语义 sourcePath 并附带至少一个正文预览。
