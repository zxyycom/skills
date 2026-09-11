### Case TEST-EVIDENCE-LEDGER-INDEX-CHECK-001: 索引同步区分缺失、已写入与当前状态

Tests:
- `test:a712088575ce52c4523cce1923164fbf81bc6e2e1add91da556fbfaaa7534f65`

Tags:
- `test-evidence`

Contract:
- 索引同步必须区分缺失索引、首次写入和已与来源一致的索引。

Proves:
- check 在缺失索引时返回 `index-missing`；首次 write 返回 `written`；再次 write 返回 `unchanged` 且 `changed` 为 false。
