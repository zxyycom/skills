### Case FILE-TEXT-SEARCH-ABORT-001: 文件搜索遵守已取消的信号

Entry:
- `tools/shared/tests/file-text-search.test.ts > honors an already aborted search`
- `bun test --test-name-pattern="^honors an already aborted search$" ./tools/shared/tests/file-text-search.test.ts`

Contract:
- 文件文本搜索在开始前发现 AbortSignal 已取消时必须停止并报告取消。

Proves:
- 已取消请求拒绝为 code 为 aborted 的 FileTextSearchError。
