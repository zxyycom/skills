### Case TEST-EVIDENCE-SNAPSHOT-INPUTS-001: 快照输入与选择边界优先阻断

Tests:
- `test:66d35d8fc37a3b36db5726792d11eda84023c2c0da21adcdc51adc8e28bfb186`

Tags:
- `test-evidence`

Contract:
- 引用检查必须分别优先报告无效快照、expected source 不匹配和未知 Case 选择，不能将它们误报为引用缺失。

Proves:
- 非法版本、错误 revision 与未知 Case ID 分别返回 snapshot-invalid、source-mismatch 和 case-invalid。
