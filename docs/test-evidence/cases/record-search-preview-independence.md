### Case RECORD-SEARCH-PREVIEWS-001: 预览受限不影响记录身份与完整扫描

Tests:
- `test:0b975f9c26214d3dc0fdf833c07c4a16f3724683b8ff2e91923b383f89bd056d`
- `test:39fa9355618c8ab15e816cd6c254475b0acded804d35d807e7632d23d5c7584f`
- `test:dd5ac7835ff3fc8cc072fbc5e54a90c392e58964a452fe5d03dfa8480faebe36`
- `test:fa3f481af0e225473d171986acc28a95b78daf7ec350c3178c3737083140d5ed`

Tags:
- `record-search`

Contract:
- content 搜索的预览预算只限制已返回记录的片段；范围与字符限制分别报告实际省略。

Proves:
- 耗尽字符预算后仍返回后续命中身份及空 previews，并保留 exact 计数和完整扫描/结果覆盖。
- 只有实际省略产生 match-previews 或 preview-characters；领域 warning 按类去重。
