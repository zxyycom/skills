### Case FILE-TEXT-SEARCH-PREVIEW-001: 文件搜索合并上下文窗口并区分命中行

Entry:
- `tools/shared/tests/file-text-search.test.ts > merges overlapping context windows and marks context lines without match ranges`
- `bun test --test-name-pattern="^merges overlapping context windows and marks context lines without match ranges$" ./tools/shared/tests/file-text-search.test.ts`

Contract:
- 相邻或重叠的命中上下文窗口必须合并；上下文行保留行号与预览但不伪造命中范围。

Proves:
- 连续命中的两个窗口以一个连续行序列输出。
- 只有实际命中行带列号和 ranges，首尾上下文行的 ranges 为空。
