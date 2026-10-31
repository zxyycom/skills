### Case INVESTIGATION-SEARCH-MODES-001: search 以匹配模式和结构筛选检索正式 Markdown

Tests:
- `test:626e4c5f7cc89ad6b8340dba7f22c98d80e6b8961ad49db5c0b91159d8d4f218`

Tags:
- `investigation-report`

Contract:
- Investigation search 只在正式报告 Markdown 中提供 all、any、phrase 文本匹配，并能与 tag、formedAt 范围和直接 relation type 结构筛选组合；结果保持 Investigation ID 与 sourcePath 身份分离。

Proves:
- 默认 all、phrase 与带结构筛选的 any 查询均返回匹配的正式 Investigation ID。
- 匹配结果投影语义 sourcePath 并附带至少一个正文预览。
