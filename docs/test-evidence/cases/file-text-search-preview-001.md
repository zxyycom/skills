### Case FILE-TEXT-SEARCH-PREVIEW-001: 文件搜索合并上下文窗口并区分命中行

Tests:
- `test:5cf56ae030f28e2531c86f66cdc5e4f4e3732f0dc829354cd0dab071f01747fa`

Tags:
- `index-runtime`

Contract:
- 相邻或重叠的命中上下文窗口必须合并；上下文行保留行号与预览但不伪造命中范围。

Proves:
- 连续命中的两个窗口以一个连续行序列输出。
- 只有实际命中行带列号和 ranges，首尾上下文行的 ranges 为空。
