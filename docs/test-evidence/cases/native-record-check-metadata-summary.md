### Case NATIVE-RECORD-CHECK-METADATA-SUMMARY-001: 决策检查的元数据摘要与正文错误

Tests:
- `test:b7660a1ff23897480d9840e9d5d219279d39e10ff4813445c67e307a9f69188d`

Tags:
- `record-rust`

Contract:
- 正文无效不应丢失已有效解析的决策元数据摘要，独立错误须有序报告。

Proves:
- 私有来源经真实 CLI 输出失败、保留决策与 active 数量，并按来源路径报告两个诊断。
