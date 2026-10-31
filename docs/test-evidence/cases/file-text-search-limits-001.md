### Case FILE-TEXT-SEARCH-LIMITS-001: 文件搜索报告每类输出截断

Tests:
- `test:3eb294ca6ec9c7e79d37733b30cbf7adcf01dfdbcbbb02a5fcb283d95b0fa450`

Tags:
- `index-runtime`

Contract:
- 文件数、每文件命中数和预览字符数的输出限制必须分别暴露截断事实，不能把不完整结果表述为完整。

Proves:
- 文件数和每文件命中数受限时，结果分别标记 files 与 matches 截断。
- 达到文件数限制后，后续命中文件不再参与命中范围或预览预算处理，因此不会伪报 matches 截断。
- 预览字符预算不足时，保留可输出的命中预览并标记 previewCharacters 截断。
- 单行多命中受限且预览裁剪时，同时保留裁剪后的首个命中范围并分别标记两种截断。
