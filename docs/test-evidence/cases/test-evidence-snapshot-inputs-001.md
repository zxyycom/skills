### Case TEST-EVIDENCE-SNAPSHOT-INPUTS-001: 快照结构来源与选择失败状态分离

Tests:
- `test:44e497b1c1b311e49165d61a7bfe5126dc8b881867f5d4ab6b0837eed3b78968`

Tags:
- `test-evidence`

Contract:
- 引用检查区分无效快照、expected source 不匹配与未知 Case 选择。

Proves:
- 三个独立失败样本中的非法版本、错误 revision 与未知 Case ID 分别返回 snapshot-invalid、source-mismatch 和 case-invalid。
