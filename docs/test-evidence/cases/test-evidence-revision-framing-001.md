### Case TEST-EVIDENCE-REVISION-FRAMING-001: Case Revision 规范化 CRLF

Tests:
- `test:e9dcbebab4581c37d8e78310877030e9038a6a8c15497082b27d66da358842f0`

Tags:
- `test-evidence`

Contract:
- Case entry revision 必须由 LF 规范化后的 Case 文本计算；CRLF 不得制造 revision 变化。

Proves:
- 将同一 Case 文本改为 CRLF 后，完整 sourceRevision 保持不变。
