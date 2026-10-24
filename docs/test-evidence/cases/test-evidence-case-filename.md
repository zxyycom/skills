### Case TEST-EVIDENCE-CASE-FILENAME-001: Case 文件名拒绝不受支持形式

Tests:
- `test:fa8afa78a560b5352b74d2d3648e74f3dc23baf2e5cbb73397e6b8ac7e7713a1`

Tags:
- `test-evidence`

Contract:
- 直属 Case Markdown 文件名遵守 kebab-case 约束。

Proves:
- 从健康 fixture 单独增加不受支持文件名，精确报告 case.member-unsupported。
