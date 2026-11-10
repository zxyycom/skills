### Case IR-RESOURCE-ACCEPTANCE-OUTPUT-001: 已接受诊断不占终端预览

Tests:
- `test:44c22e7b81e30cfe0ae07059f5ac22cd8ea1099d6d3b31f197940419a0daf6b5`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 结构化结果保留全部诊断及接受理由，终端先过滤已接受项，再限制待处理明细。

Proves:
- 13 项已接受、1 项待处理时 JSON 全部保留、警告总数与未省略计数正确且理由可回读；stderr 汇报数量并显示待处理项，不输出已接受项或虚假的截断提示。
