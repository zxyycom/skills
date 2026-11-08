### Case RECORD-SEARCH-FILTERS-001: 元信息回显已解析的实际筛选

Tests:
- `test:6ba04530eb319d5261a54f9fe714c4e16de92b86e0519c7aa4dc00251590b5fa`

Tags:
- `record-search`

Contract:
- DR search 回显本次解析后的实际关系目标和结构筛选。

Proves:
- 真实 content CLI 用 prior name 选择关系并加 tag 后，searchInfo 回显完整目标 ID、tag 和 active 状态，返回符合发布边的记录。
