### Case FILE-TEXT-SEARCH-ABORT-001: 文件搜索遵守已取消的信号

Tests:
- `test:9458dbe5ebf12ffefe8013c9096c6e0e266c42d9ffed38d0110fceca5748da18`
- `test:ed5df54a054289be256f8594aa26ca544df6235b1771f26c36fe81fc1eac9463`

Tags:
- `index-runtime`

Contract:
- 文件文本搜索在开始前发现 AbortSignal 已取消时必须停止并报告取消。

Proves:
- 已取消请求拒绝为 code 为 aborted 的 FileTextSearchError。
