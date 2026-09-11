### Case FILE-TEXT-SEARCH-LIMITS-001: 文件搜索报告每类输出截断

Tests:
- `test:a9479af78e65c0ad73b7fb8b5763190501e7f3dee836d7cd8717b601a1d3d7cb`

Tags:
- `index-runtime`

Contract:
- 文件数、每文件命中数和预览字符数的输出限制必须分别暴露截断事实，不能把不完整结果表述为完整。

Proves:
- 文件数和每文件命中数受限时，结果分别标记 files 与 matches 截断。
- 达到文件数限制后，后续命中文件不再参与命中范围或预览预算处理，因此不会伪报 matches 截断。
- 预览字符预算不足时，保留可输出的命中预览并标记 previewCharacters 截断。
