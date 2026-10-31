### Case INVESTIGATION-DISCARD-FINAL-001: discard removes a final report and confirmed owner resources

Tests:
- `test:1c5ecd840d37fda63aaab098a2f188145151cea5cabcdb6ef1992b597324cda7`

Tags:
- `investigation-report`

Contract:
- 删除有 owner-prefix 资源的报告必须显式确认资源删除；成功删除最后一份已建立报告后，派生空索引仍可被完整检查和列表查询使用。

Proves:
- 未确认资源删除时无写入并给出参数提示；确认后报告及资源消失，且没有遗留 tombstone。
- 完整 check 成功且 list 返回空集合。
