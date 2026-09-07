### Case FILE-TEXT-SEARCH-ABORT-001: 文件搜索遵守已取消的信号

Tests:
- `test:7fd51c8188453c4fbf346914c76a32649f2f796b5c257553f7c16e620edcc95e`
- `test:86842eb1045ae7dd0e314d2d66bbaf08a93d454d8fbe3f25f7b4964ea433739a`

Tags:
- `index-runtime`

Contract:
- 文件文本搜索在开始前发现 AbortSignal 已取消时必须停止并报告取消。

Proves:
- 已取消请求拒绝为 code 为 aborted 的 FileTextSearchError。
