### Case TEST-EVIDENCE-SNAPSHOT-INPUTS-001: 快照输入与选择边界优先阻断

Tests:
- `test:2c9508d7c7b9648420d4c003b17d58af34d1a9c4de5d265708488b384839c326`

Tags:
- `test-evidence`

Contract:
- 引用检查必须分别优先报告无效快照、expected source 不匹配和未知 Case 选择，不能将它们误报为引用缺失。

Proves:
- 非法版本、错误 revision 与未知 Case ID 分别返回 snapshot-invalid、source-mismatch 和 case-invalid。
