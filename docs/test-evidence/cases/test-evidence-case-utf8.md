### Case TEST-EVIDENCE-CASE-UTF8-001: Case 来源拒绝非法 UTF-8

Tests:
- `test:fcc028ba4ac7d337bd4123e98601400267708e58f9faaaeef6bad7a38181bab7`

Tags:
- `test-evidence`

Contract:
- Case 来源必须是可严格读取的 UTF-8 正文。

Proves:
- 健康 fixture 的 Case 写入 0xFF 后精确报告 case.read-failed，不伪装合法空集合。
