### Case FILE-TEXT-SEARCH-SELECTION-001: 文件搜索统一选择模式与显式根内文件

Tests:
- `test:13da082a4d01d57848ac8dcd2f3e45b0943c3782bcbda41b4bb1cba5a89e1c15`

Tags:
- `index-runtime`

Contract:
- 文件文本搜索必须仅选择 root 内的普通文件；pattern 和显式 sourcePath 列表对同一集合产生确定性的相同文件选择。

Proves:
- 排除 txt 的 pattern 与去重后的显式 Markdown 文件列表都按 sourcePath 顺序返回同一命中集合。
- 未触发任何输出截断时，结果明确报告所有截断标志为 false。
