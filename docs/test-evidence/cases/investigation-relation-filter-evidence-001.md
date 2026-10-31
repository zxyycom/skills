### Case INVESTIGATION-RELATION-FILTER-EVIDENCE-001: 关系筛选投影完整匹配边并按预算展示

Tests:
- `test:b29eaec67c6326df6e43be857b61fd113d68bac27d9d7e650da8a1a38994d99d`
- `test:ba9548856333813eef2d10a85c4c6771939c293ab930a5ab5d3074b7df1f3b02`

Tags:
- `investigation-report`

Contract:
- 关系筛选证据按稳定目标顺序输出，CLI 预览遵守声明预算。

Proves:
- 乱序目标与多条关系返回准确排序/去重摘要，CLI 输出遵守每条预览预算；样本不区分 locale 与 UTF-16 排序实现。
