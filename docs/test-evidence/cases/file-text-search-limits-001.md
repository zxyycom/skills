### Case FILE-TEXT-SEARCH-LIMITS-001: 文件搜索报告每类输出截断

Tests:
- `test:5549d54e998fef4bf2a058b357aca4a9e03ae5c34d5b834d4bc4eceaf8df8205`

Tags:
- `index-runtime`

Contract:
- 文件数、每文件命中数和预览字符数的输出限制必须分别暴露截断事实，不能把不完整结果表述为完整。

Proves:
- 文件数和每文件命中数受限时，结果分别标记 files 与 matches 截断。
- 预览字符预算不足时，保留可输出的命中预览并标记 previewCharacters 截断。
