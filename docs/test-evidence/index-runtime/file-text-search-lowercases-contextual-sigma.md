### Case FILE-TEXT-SEARCH-UNICODE-CASE-001: 文件搜索按整行处理希腊 sigma 小写

Entry:
- `tools/shared/tests/file-text-search.test.ts > uses whole-line lowercase semantics for contextual Greek sigma`
- `bun test --test-name-pattern="^uses whole-line lowercase semantics for contextual Greek sigma$" ./tools/shared/tests/file-text-search.test.ts`

Contract:
- 无大小写差异的文件文本匹配必须按整行小写语义处理有上下文形式的 Unicode 字符。

Proves:
- 全大写希腊词可由带词尾 sigma 的小写短语查询匹配。
- 返回原始行和覆盖整词的原始范围。
