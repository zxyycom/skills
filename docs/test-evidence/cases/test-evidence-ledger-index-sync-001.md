### Case TEST-EVIDENCE-LEDGER-INDEX-SYNC-001: Case 索引同步确定地区分写入与当前状态

Tests:
- `test:a712088575ce52c4523cce1923164fbf81bc6e2e1add91da556fbfaaa7534f65`

Tags:
- `test-evidence`

Contract:
- 写入同步必须从当前 Case 源生成索引，并在索引当前时保持无变化。

Proves:
- 首次 write 返回 written，重复 write 返回 unchanged。
