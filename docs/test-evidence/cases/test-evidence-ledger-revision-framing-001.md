### Case TEST-EVIDENCE-LEDGER-REVISION-FRAMING-001: Case revision 区分 CRLF 与成员变化

Tests:
- `test:e9dcbebab4581c37d8e78310877030e9038a6a8c15497082b27d66da358842f0`

Tags:
- `test-evidence`

Contract:
- Case entry revision 以 LF 规范化后的 Case 文本计算；成员增删只影响对应 revision。

Proves:
- 同一文本改用 CRLF 后 sourceRevision 不变；新增和删除第三个 Case 时，未触及 Case 的 revision 始终保持不变。
