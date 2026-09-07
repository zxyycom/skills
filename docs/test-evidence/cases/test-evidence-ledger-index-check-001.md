### Case TEST-EVIDENCE-LEDGER-INDEX-CHECK-001: 索引同步区分缺失、已写入与当前状态

Tests:
- `test:ab056b60618eb9a9d2f16753dde84c15e9bb203d7303f0abb047d3512911a38f`

Tags:
- `test-evidence`

Contract:
- 索引同步必须区分缺失索引、首次写入和已与来源一致的索引。

Proves:
- check 在缺失索引时返回 `index-missing`；首次 write 返回 `written`；再次 write 返回 `unchanged` 且 `changed` 为 false。
