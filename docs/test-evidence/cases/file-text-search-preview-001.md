### Case FILE-TEXT-SEARCH-PREVIEW-001: 文件搜索合并上下文窗口并区分命中行

Tests:
- `test:b6d86d094ea4eb6e41a48a5da299b676f836a500c80c57ce40d11e951f7fdd0c`

Tags:
- `index-runtime`

Contract:
- 相邻或重叠的命中上下文窗口必须合并；上下文行保留行号与预览但不伪造命中范围。

Proves:
- 连续命中的两个窗口以一个连续行序列输出。
- 只有实际命中行带列号和 ranges，首尾上下文行的 ranges 为空。
