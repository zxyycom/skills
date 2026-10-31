### Case FILE-TEXT-SEARCH-PREVIEW-BUDGET-001: 文件搜索先保留命中预览再消耗上下文预算

Tests:
- `test:592eca3279b21469a80e044c733fac598c6cf3efab994905159a5751530f445c`

Tags:
- `index-runtime`

Contract:
- 预览字符预算不足时，文件文本搜索必须优先保留命中行，而不是由上下文耗尽预算。

Proves:
- 上下文行超过预算时仍输出完整可容纳的命中行及其范围。
- 省略上下文后结果标记 previewCharacters 截断。
- 匹配文件已无法再输出预览时停止扫描，后续不可读文件不会改变既有截断结果。
