### Case RESOURCE-LITERAL-ARGUMENTS-001: 真实参数与字面搜索

Tests:
- `test:0e7f976a83fad6bd8709200f637aed567ae45241af8f565ce38fc69edde6635f`
- `test:160a11950dfc5bd5f4f262296db7dfdd2564e787502b6e386019ba2abdce3f03`
- `test:c0f9f991f4110d6b1c0f777cadec7fa8b189f97632a2bd6e283f98465256499b`

Tags:
- `resource-records`

Contract:
- 合法前导连字符身份可查询；帮助标记可作为检索文本，正文搜索按字面匹配。

Proves:
- 真实 argv 使用 -- 传递 ID 和 --help 文本；跨行文本仍返回命中。
