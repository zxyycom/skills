### Case TEST-EVIDENCE-REVISION-FRAMING-001: Case Revision 规范化 CRLF

Tests:
- `test:1067e16cb03f9e6a286373ef10be19277eefd693e4898c33fd5e4f4b9a66e8e3`

Tags:
- `test-evidence`

Contract:
- Case entry revision 必须由 LF 规范化后的 Case 文本计算；CRLF 不得制造 revision 变化。

Proves:
- 将同一 Case 文本改为 CRLF 后，完整 sourceRevision 保持不变。
