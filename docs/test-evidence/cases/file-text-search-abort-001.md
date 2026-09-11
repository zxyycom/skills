### Case FILE-TEXT-SEARCH-ABORT-001: 文件搜索遵守已取消的信号

Tests:
- `test:9ae51cd0758c06e12b4bde53c020853327145db176e62c4e4f7e86bd1c4b4928`
- `test:bde344d7a447f26abe03e6c178bce724857e8258871d3d6b9de78f7490cc49c5`

Tags:
- `index-runtime`

Contract:
- 文件文本搜索在开始前发现 AbortSignal 已取消时必须停止并报告取消。

Proves:
- 已取消请求拒绝为 code 为 aborted 的 FileTextSearchError。
